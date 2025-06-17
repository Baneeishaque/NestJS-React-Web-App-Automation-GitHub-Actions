{ pkgs, ... }: {
  channel = "unstable";

  packages = [
    pkgs.git-filter-repo
  ];

  env = { };
  idx = {
    extensions = [
    ];

    previews = {
      enable = true;
      previews = {
      };
    };

    workspace = {
      onCreate = {
      };
      onStart = {
      };
    };
  };
}
