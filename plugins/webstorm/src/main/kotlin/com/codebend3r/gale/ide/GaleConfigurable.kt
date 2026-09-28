package com.codebend3r.gale.ide

import com.codebend3r.gale.generated.GaleFacts
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.options.BoundConfigurable
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.AlignX
import com.intellij.ui.dsl.builder.bindSelected
import com.intellij.ui.dsl.builder.bindText
import com.intellij.ui.dsl.builder.panel

/** Settings › Tools › Gale. Applying restarts the server. */
class GaleConfigurable internal constructor(
    private val project: Project,
    private val restart: (Project) -> Unit,
) : BoundConfigurable("Gale") {
    constructor(project: Project) : this(project, ::restartGale)

    override fun createPanel(): DialogPanel {
        val state = GaleSettings.getInstance(project).state
        return panel {
            row {
                checkBox("Enable Gale")
                    .bindSelected(state::enabled)
                    .comment(GaleFacts.ENABLE_DESCRIPTION)
            }
            row("Config path:") {
                textFieldWithBrowseButton(FileChooserDescriptorFactory.singleFile(), project)
                    .bindText({ state.configPath.orEmpty() }, { state.configPath = it })
                    .comment(GaleFacts.CONFIG_PATH_DESCRIPTION)
                    .align(AlignX.FILL)
            }
            row("Binary path:") {
                textFieldWithBrowseButton(FileChooserDescriptorFactory.singleFile(), project)
                    .bindText({ state.binaryPath.orEmpty() }, { state.binaryPath = it })
                    .comment(GaleFacts.BINARY_PATH_DESCRIPTION)
                    .align(AlignX.FILL)
            }
        }
    }

    override fun apply() {
        super.apply()
        restart(project)
    }
}
