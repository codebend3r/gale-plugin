package com.codebend3r.gale.ide

import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.vfs.newvfs.events.VFileContentChangeEvent
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.testFramework.LightVirtualFile

class GaleConfigFileListenerTest : GaleTestCase() {
    private val restarted = mutableListOf<Project>()

    private fun changed(name: String): VFileEvent = VFileContentChangeEvent(null, LightVirtualFile(name), 0, 1)

    fun testRestartsWhenAConfigFileAboveTheProjectRootChanges() {
        // A LightVirtualFile lives at the filesystem root, an ancestor of every project root.
        GaleConfigFileListener(project) { restarted += it }.after(listOf(changed("styles.css"), changed("gale.json")))

        assertEquals(listOf(project), restarted)
    }

    fun testIgnoresChangesThatCantChangeGalesConfig() {
        GaleConfigFileListener(project) { restarted += it }.after(listOf(changed("styles.css")))

        assertEmpty(restarted)
    }

    fun testIgnoresProjectsWithoutABasePath() {
        val defaultProject = ProjectManager.getInstance().defaultProject

        GaleConfigFileListener(defaultProject) { restarted += it }.after(listOf(changed("gale.json")))

        assertEmpty(restarted)
    }

    fun testThePlatformCreatedListenerRestartsGale() {
        GaleConfigFileListener(project).after(listOf(changed("gale.json")))
    }
}
