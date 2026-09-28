package com.codebend3r.gale.ide

import com.codebend3r.gale.core.PathSettings
import com.codebend3r.gale.generated.GaleFacts
import com.intellij.openapi.components.BaseState
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.SimplePersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project

class GaleSettingsState : BaseState() {
    var enabled by property(GaleFacts.ENABLE_DEFAULT)
    var configPath by string(GaleFacts.CONFIG_PATH_DEFAULT)
    var binaryPath by string(GaleFacts.BINARY_PATH_DEFAULT)
}

/** Project-level Gale settings, stored in `.idea/gale.xml`. */
@Service(Service.Level.PROJECT)
@State(name = "GaleSettings", storages = [Storage("gale.xml")])
class GaleSettings : SimplePersistentStateComponent<GaleSettingsState>(GaleSettingsState()) {
    /** The path settings, trimmed. A blank path counts as unset. */
    val pathSettings: PathSettings
        get() = PathSettings(state.configPath.orEmpty().trim(), state.binaryPath.orEmpty().trim())

    companion object {
        fun getInstance(project: Project): GaleSettings = project.service()
    }
}
