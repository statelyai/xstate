{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        nodeVersion = builtins.readFile ./.node-version;
        majorNodeVersion = builtins.substring 0 2 nodeVersion;
        node = pkgs."nodejs_${majorNodeVersion}";
      in
      {
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            just
            node
            node.pkgs.pnpm
          ];
        };
      }
    );
}
