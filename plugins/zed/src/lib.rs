//! Zed glue: gathers settings, platform, and probes from Zed, then asks the
//! contract which command to run. Excluded from coverage because
//! `zed_extension_api` calls only work inside Zed.

mod contract;
mod generated;

#[cfg(test)]
mod conformance_tests;

use contract::{Os, Platform, Probe, Resolution};
use zed_extension_api::{self as zed, LanguageServerId, Result, settings::LspSettings};

struct GaleExtension;

impl zed::Extension for GaleExtension {
    fn new() -> Self {
        GaleExtension
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let lsp = LspSettings::for_worktree(language_server_id.as_ref(), worktree)?;
        let (binary_path, arguments) = match lsp.binary {
            Some(binary) => (binary.path, binary.arguments),
            None => (None, None),
        };
        let settings = contract::path_settings(binary_path.as_deref(), lsp.settings.as_ref());
        let root = worktree.root_path();
        let platform = current_platform();
        let project_path = contract::project_binary_path(Some(&root), platform);
        let probe = Probe {
            project_installed: project_path.as_deref().is_some_and(is_file),
            which: worktree.which(generated::SERVER_COMMAND),
        };
        match contract::resolve_binary(&settings, Some(&root), platform, &probe) {
            Resolution::Found { command, .. } => Ok(zed::Command {
                command,
                args: contract::command_args(&settings, arguments),
                env: Vec::new(),
            }),
            Resolution::NotFound => Err(generated::MISSING_BINARY_MESSAGE.to_string()),
        }
    }
}

fn current_platform() -> Platform<'static> {
    let (os, arch) = zed::current_platform();
    Platform {
        os: match os {
            zed::Os::Mac => Os::Darwin,
            zed::Os::Linux => Os::Linux,
            zed::Os::Windows => Os::Win32,
        },
        arch: match arch {
            zed::Architecture::Aarch64 => "arm64",
            zed::Architecture::X8664 => "x64",
            zed::Architecture::X86 => "ia32",
        },
    }
}

/// Zed can't see files under gitignored folders like `node_modules`, so this
/// asks `test -f` (granted by the `process:exec` capability in extension.toml).
fn is_file(path: &str) -> bool {
    zed::process::Command::new("test")
        .args(["-f", path])
        .output()
        .is_ok_and(|output| output.status == Some(0))
}

zed::register_extension!(GaleExtension);
