//! The shared Gale contract in Rust, plus the Zed-only settings logic. The
//! generated conformance tests check it against the same cases as the
//! TypeScript and Kotlin implementations.

use crate::generated::{
    CONFIG_ARG, CONFIG_PATH_SETTING, LSP_ARG, NPM_BIN_DIR, NPM_PACKAGE_NAME, PLATFORMS,
    SERVER_COMMAND,
};
use zed_extension_api::serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Os {
    Darwin,
    Linux,
    Win32,
}

impl Os {
    /// The Node.js name the platform table uses.
    fn node_name(self) -> &'static str {
        match self {
            Os::Darwin => "darwin",
            Os::Linux => "linux",
            Os::Win32 => "win32",
        }
    }
}

/// `arch` is a Node.js-style name: "arm64", "x64", or anything else.
#[derive(Clone, Copy, Debug)]
pub struct Platform<'a> {
    pub os: Os,
    pub arch: &'a str,
}

/// The only settings the contract functions read.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PathSettings {
    pub config_path: String,
    pub binary_path: String,
}

/// What the host found before calling `resolve_binary`: the project's binary
/// (`project_binary_path`) when it exists on disk, and `gale` on PATH.
#[derive(Clone, Debug)]
pub struct Probe {
    pub project_binary: Option<String>,
    pub which: Option<String>,
}

/// The Rust target Gale publishes for this platform, or `None` if it publishes none.
pub fn rust_target(platform: Platform) -> Option<&'static str> {
    PLATFORMS
        .iter()
        .find(|(os, arch, _)| *os == platform.os.node_name() && *arch == platform.arch)
        .map(|(_, _, target)| *target)
}

pub fn binary_file_name(os: Os) -> String {
    match os {
        Os::Win32 => format!("{SERVER_COMMAND}.exe"),
        Os::Darwin | Os::Linux => SERVER_COMMAND.to_string(),
    }
}

/// Where a project install of `@codebend3r/gale` keeps the native binary.
/// Zed extensions run as WASM with POSIX path rules, so this joins with `/`.
pub fn project_binary_path(root: Option<&str>, platform: Platform) -> Option<String> {
    let root = root?.trim_end_matches('/');
    let target = rust_target(platform)?;
    let file = binary_file_name(platform.os);
    Some(format!(
        "{root}/node_modules/{NPM_PACKAGE_NAME}/{NPM_BIN_DIR}/{target}/{file}"
    ))
}

/// Picks the binary to run: the setting, then the project install, then PATH.
pub fn resolve_binary(settings: &PathSettings, probe: Probe) -> Option<String> {
    if !settings.binary_path.is_empty() {
        return Some(settings.binary_path.clone());
    }
    probe.project_binary.or(probe.which)
}

/// `--lsp`, plus `--config <path>` exactly as the user wrote it.
pub fn server_args(settings: &PathSettings) -> Vec<String> {
    let mut args = vec![LSP_ARG.to_string()];
    if !settings.config_path.is_empty() {
        args.push(CONFIG_ARG.to_string());
        args.push(settings.config_path.clone());
    }
    args
}

/// Reads `lsp.gale.binary.path` and `lsp.gale.settings.configPath`. A missing
/// or non-string value counts as unset, and whitespace around a path is dropped.
pub fn path_settings(binary_path: Option<&str>, settings: Option<&Value>) -> PathSettings {
    let config_path = settings
        .and_then(|settings| settings.get(CONFIG_PATH_SETTING))
        .and_then(Value::as_str);
    PathSettings {
        config_path: config_path.unwrap_or_default().trim().to_string(),
        binary_path: binary_path.unwrap_or_default().trim().to_string(),
    }
}

/// `lsp.gale.binary.arguments` replaces the computed arguments, following Zed's convention.
pub fn command_args(settings: &PathSettings, arguments: Option<Vec<String>>) -> Vec<String> {
    arguments.unwrap_or_else(|| server_args(settings))
}

#[cfg(test)]
mod tests {
    use super::*;
    use zed_extension_api::serde_json::json;

    #[test]
    fn path_settings_reads_config_path_and_binary_path() {
        let settings = json!({ "configPath": "config/gale.json" });

        assert_eq!(
            path_settings(Some("/opt/gale/bin/gale"), Some(&settings)),
            PathSettings {
                config_path: "config/gale.json".to_string(),
                binary_path: "/opt/gale/bin/gale".to_string(),
            }
        );
    }

    #[test]
    fn path_settings_defaults_to_empty() {
        assert_eq!(path_settings(None, None), PathSettings::default());
    }

    #[test]
    fn path_settings_ignores_a_non_string_config_path() {
        let settings = json!({ "configPath": 42 });

        assert_eq!(
            path_settings(None, Some(&settings)),
            PathSettings::default()
        );
    }

    #[test]
    fn path_settings_ignores_settings_without_a_config_path() {
        let settings = json!({ "other": "value" });

        assert_eq!(
            path_settings(None, Some(&settings)),
            PathSettings::default()
        );
    }

    #[test]
    fn path_settings_trims_whitespace() {
        let settings = json!({ "configPath": "  gale.toml\n" });

        assert_eq!(
            path_settings(Some(" /opt/gale "), Some(&settings)),
            PathSettings {
                config_path: "gale.toml".to_string(),
                binary_path: "/opt/gale".to_string(),
            }
        );
    }

    #[test]
    fn command_args_uses_server_args_by_default() {
        let settings = PathSettings {
            config_path: "gale.toml".to_string(),
            binary_path: String::new(),
        };

        assert_eq!(
            command_args(&settings, None),
            vec!["--lsp", "--config", "gale.toml"]
        );
    }

    #[test]
    fn command_args_prefers_the_arguments_setting() {
        let arguments = vec!["--lsp".to_string(), "--verbose".to_string()];

        assert_eq!(
            command_args(&PathSettings::default(), Some(arguments.clone())),
            arguments
        );
    }
}
