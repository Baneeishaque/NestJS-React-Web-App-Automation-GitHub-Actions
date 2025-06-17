{ pkgs, ... }: {
  channel = "unstable";

  packages = [
    pkgs.git-filter-repo
    pkgs.mise
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
