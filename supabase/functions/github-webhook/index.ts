// supabase/functions/github-webhook/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface GitHubUser {
  login: string;
  [key: string]: any; // For other properties we don't care about
}

interface GitHubLabel {
  name: string;
  [key: string]: any;
}

serve(async (req) => {
  try {
    // 1. Extract and validate webhook data
    const event = req.headers.get("x-github-event");
    if (!event) {
      return new Response(
        JSON.stringify({ error: "Missing GitHub event header" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Load function configuration
    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    if (!GITHUB_TOKEN) {
      console.error("Missing GITHUB_TOKEN environment variable");
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing authentication token" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const AUTOMATION_REPO_OWNER = Deno.env.get("AUTOMATION_REPO_OWNER");
    const AUTOMATION_REPO_NAME = Deno.env.get("AUTOMATION_REPO_NAME");

    if (!AUTOMATION_REPO_OWNER || !AUTOMATION_REPO_NAME) {
      console.error("Missing repository configuration variables", {
        hasRepoOwner: !!AUTOMATION_REPO_OWNER,
        hasRepoName: !!AUTOMATION_REPO_NAME
      });
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing repository configuration" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // We'll determine the workflow URL after parsing the payload
    let workflowFilename: string | null = null;

    // 3. Parse and validate payload
    let payload;
    try {
      payload = await req.json();
    } catch (error) {
      console.error("Failed to parse JSON payload:", error);
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Determine default branch for the automation repository
    let workflowBranch;
    try {
      console.log(`Fetching repository metadata for ${AUTOMATION_REPO_OWNER}/${AUTOMATION_REPO_NAME}`);

      const repoResponse = await fetch(
        `https://api.github.com/repos/${AUTOMATION_REPO_OWNER}/${AUTOMATION_REPO_NAME}`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!repoResponse.ok) {
        const errorText = await repoResponse.text();
        console.error(`Failed to fetch automation repo info: ${repoResponse.status}`, errorText);
        return new Response(
          JSON.stringify({
            error: "Failed to fetch automation repository metadata",
            status: repoResponse.status,
            details: errorText
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const repoData = await repoResponse.json();
      workflowBranch = repoData.default_branch;

      if (!workflowBranch) {
        console.error("Repository response did not contain default_branch", repoData);
        return new Response(
          JSON.stringify({
            error: "Could not determine default branch for automation repository",
            repo_data: repoData
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      console.log(`Detected default branch for workflow repo: ${workflowBranch}`);
    } catch (error) {
      console.error("Error fetching automation repository info:", error);

      // Type check the error before accessing its properties
      const errorMessage = error instanceof Error ? error.message : String(error);

      return new Response(
        JSON.stringify({
          error: "Failed to fetch automation repository metadata",
          message: errorMessage
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Prepare base inputs (common for all event types) - limited to 10 total properties
    let inputs: Record<string, string> = {
      event_type: event,
      timestamp: new Date().toISOString()
    };

    // Add repository info from payload (limited to essential fields)
    const repositoryFullName = payload.repository ? (payload.repository.full_name || "") : "";
    if (repositoryFullName) {
      inputs.repository = repositoryFullName;
    }

    if (payload.sender) {
      inputs.sender = payload.sender.login || "Unknown";
    }

    // Load workflow mapping from environment variable
    const WORKFLOW_MAPPINGS = Deno.env.get("WORKFLOW_MAPPINGS");
    if (!WORKFLOW_MAPPINGS) {
      console.error("Missing WORKFLOW_MAPPINGS environment variable");
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing workflow mappings" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse the workflow mappings from the environment variable
    // Format: "repo1:workflow1,repo2:workflow2,repo3:workflow3"
    const workflowMapping: Record<string, string> = {};
    try {
      const mappings = WORKFLOW_MAPPINGS.split(",");
      for (const mapping of mappings) {
        const [repo, workflow] = mapping.split(":");
        if (repo && workflow) {
          workflowMapping[repo.trim()] = workflow.trim();
        }
      }

      console.log(`Parsed workflow mappings: ${Object.keys(workflowMapping).join(", ")}`);

      if (Object.keys(workflowMapping).length === 0) {
        throw new Error("No valid mappings found");
      }

      // Look up the workflow filename for this repository
      if (repositoryFullName && workflowMapping[repositoryFullName]) {
        workflowFilename = workflowMapping[repositoryFullName];
        console.log(`Using repository-specific workflow file: ${workflowFilename} for ${repositoryFullName}`);
      } else {
        console.error(`Repository ${repositoryFullName} not found in workflow mapping`);
        return new Response(
          JSON.stringify({
            error: "Repository not configured",
            message: `No workflow mapping found for repository: ${repositoryFullName}`,
            available_repositories: Object.keys(workflowMapping)
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (error) {
      console.error("Error loading workflow mapping:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to load workflow mapping",
          message: error instanceof Error ? error.message : String(error)
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!workflowFilename) {
      return new Response(
        JSON.stringify({
          error: "Could not determine workflow filename",
          repository: repositoryFullName
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Construct the workflow URL with the determined filename
    const WORKFLOW_URL = `https://api.github.com/repos/${AUTOMATION_REPO_OWNER}/${AUTOMATION_REPO_NAME}/actions/workflows/${workflowFilename}/dispatches`;

    // 6. Process by event type
    let sourceRepoBranch = ""; // Will be determined based on event type

    if (event === "push") {
      // Handle push events

      // Skip if deleted branch
      if (payload.deleted === true) {
        return new Response(
          JSON.stringify({ message: "Branch deletion event, no build needed" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Validate required push event fields
      if (!payload.ref) {
        console.error("Missing ref in push event", payload);
        return new Response(
          JSON.stringify({ error: "Invalid push event payload: missing ref" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      try {
        // Extract branch name from ref (refs/heads/branch-name)
        sourceRepoBranch = payload.ref.replace("refs/heads/", "");

        if (!sourceRepoBranch) {
          console.error("Failed to extract branch name from ref:", payload.ref);
          return new Response(
            JSON.stringify({ error: "Invalid branch reference format" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Push event data extraction - limited to stay under 10 total properties
        inputs = {
          ...inputs,
          branch: sourceRepoBranch,
          author: payload.pusher?.name || "Unknown",
          commit_sha: payload.after || "",
          commit_message: payload.head_commit?.message || "",
          commit_url: payload.head_commit?.url || "",
        };
      } catch (error) {
        console.error("Error parsing push event:", error, payload);
        return new Response(
          JSON.stringify({ error: "Failed to process push event data" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } else if (event === "pull_request") {
      // Handle pull request events

      // Validate required PR event fields
      if (!payload.action || !payload.pull_request) {
        console.error("Missing required PR fields", payload);
        return new Response(
          JSON.stringify({ error: "Invalid PR event payload: missing action or pull_request" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const prAction = payload.action;

      // Define which PR actions should trigger a build
      const buildTriggeringActions = [
        "opened",
        "reopened",
        "synchronize"
      ];

      // For non-build-triggering actions, we can still record the event but not trigger a build
      if (!buildTriggeringActions.includes(prAction)) {
        console.log(`PR action '${prAction}' doesn't trigger a build`);
        return new Response(
          JSON.stringify({
            message: `PR action '${prAction}' doesn't trigger a build`,
            pr_number: payload.number,
            pr_action: prAction
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      try {
        // Extract branch name and validate it's not empty
        sourceRepoBranch = payload.pull_request.head?.ref || "";

        if (!sourceRepoBranch) {
          console.error("Failed to extract branch name from PR:", payload.pull_request);
          return new Response(
            JSON.stringify({ error: "Missing branch information in PR data" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // PR event data extraction - limited to stay under 10 total properties
        inputs = {
          ...inputs,
          branch: sourceRepoBranch,
          pr_number: payload.number?.toString() || "",
          pr_action: prAction,
          author: payload.pull_request.user?.login || "Unknown",
          pr_title: payload.pull_request.title || "",
          pr_url: payload.pull_request.html_url || "",
          target_branch: payload.pull_request.base?.ref || "",
        };
      } catch (error) {
        console.error("Error parsing PR event:", error, payload);
        return new Response(
          JSON.stringify({ error: "Failed to process PR event data" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    } else {
      // Other event types (issues, issue_comment, etc.)
      console.log(`Ignoring event type: ${event}`);
      return new Response(
        JSON.stringify({ message: `Ignored event: ${event}` }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Double-check that branch is set and not empty - no fallbacks, just error
    if (!inputs.branch) {
      console.error("Branch is missing or empty after processing event");
      return new Response(
        JSON.stringify({
          error: "Could not determine branch to build",
          event: event,
          payload_excerpt: JSON.stringify(payload).substring(0, 1000)
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 7. Ensure inputs contains max 10 properties before triggering workflow
    const inputKeys = Object.keys(inputs);
    if (inputKeys.length > 10) {
      console.warn(`Too many input properties (${inputKeys.length}), GitHub API limit is 10. Trimming inputs.`);

      // Keep only the most important properties (max 10)
      const essentialKeys = [
        'event_type',
        'timestamp',
        'repository',
        'sender',
        'branch',
        'author',
        'commit_sha', // for push events
        'pr_number',  // for PR events
        'pr_title',   // for PR events
        'target_branch' // for PR events
      ];

      // Create a new inputs object with only the essential keys
      const trimmedInputs: Record<string, string> = {};
      for (const key of essentialKeys) {
        if (inputs[key] !== undefined) {
          trimmedInputs[key] = inputs[key];
          // Stop after 10 properties
          if (Object.keys(trimmedInputs).length >= 10) break;
        }
      }

      console.log(`Trimmed inputs from ${inputKeys.length} to ${Object.keys(trimmedInputs).length} properties`);
      inputs = trimmedInputs;
    }

    // Call GitHub Actions workflow_dispatch
    console.log(`Triggering workflow for ${event} event with inputs:`, inputs);

    let res;
    try {
      res = await fetch(WORKFLOW_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: workflowBranch,
          inputs,
        }),
      });
    } catch (error) {
      console.error("Network error triggering workflow:", error);

      // Type check the error before accessing its properties
      const errorMessage = error instanceof Error ? error.message : String(error);

      return new Response(
        JSON.stringify({ error: "Network error", message: errorMessage }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 8. Handle response
    if (res.ok) {
      console.log("Workflow triggered successfully");
      return new Response(
        JSON.stringify({
          message: "Workflow triggered successfully",
          event,
          inputs,
          automation_repo: `${AUTOMATION_REPO_OWNER}/${AUTOMATION_REPO_NAME}`,
          workflow_filename: workflowFilename,
          workflow_branch: workflowBranch,
          source_branch: sourceRepoBranch,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else {
      let errorText = "";
      let errorJson = null;

      try {
        // Try to parse as JSON first
        errorJson = await res.json();
        errorText = JSON.stringify(errorJson);
      } catch (_e) {
        // Fall back to text
        try {
          errorText = await res.text();
        } catch (_e2) {
          errorText = "Could not read error response";
        }
      }

      console.error(`Failed to trigger workflow: ${res.status}`, errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to trigger workflow",
          status: res.status,
          details: errorJson || errorText
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
   // Catch-all for unexpected errors
    console.error("Unexpected error processing webhook:", error);

    // Type checking for the error object
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const errorStack = error instanceof Error ? error.stack : undefined;

    return new Response(
      JSON.stringify({
        error: "Server error",
        message: errorMessage,
        stack: Deno.env.get("ENVIRONMENT") === "development" ? errorStack : undefined
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
