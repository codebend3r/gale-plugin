package com.codebend3r.gale.ide

import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project

// Kept alone in this file so build.gradle.kts can exclude it from coverage:
// it opens the modal Settings dialog, which needs a display.

fun openGaleSettings(project: Project) {
    ShowSettingsUtil.getInstance().showSettingsDialog(project, GaleConfigurable::class.java)
}
