package com.codebend3r.gale.ide

import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.project.Project

class RestartGaleAction internal constructor(
    private val restart: (Project) -> Unit,
) : DumbAwareAction() {
    constructor() : this(::restartGale)

    override fun actionPerformed(e: AnActionEvent) {
        e.project?.let(restart)
    }
}
