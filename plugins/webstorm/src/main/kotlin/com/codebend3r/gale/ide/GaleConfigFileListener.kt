package com.codebend3r.gale.ide

import com.codebend3r.gale.core.shouldRestart
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent

/** Restarts Gale when a file changes that can change the config Gale loads. */
class GaleConfigFileListener internal constructor(
    private val project: Project,
    private val restart: (Project) -> Unit,
) : BulkFileListener {
    constructor(project: Project) : this(project, ::restartGale)

    override fun after(events: List<VFileEvent>) {
        val root = project.basePath ?: return
        val settings = GaleSettings.getInstance(project).pathSettings
        if (events.any { shouldRestart(it.path, root, settings) }) {
            restart(project)
        }
    }
}
