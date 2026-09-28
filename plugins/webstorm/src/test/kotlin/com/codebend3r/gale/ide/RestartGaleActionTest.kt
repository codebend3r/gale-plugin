package com.codebend3r.gale.ide

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.actionSystem.impl.SimpleDataContext
import com.intellij.openapi.project.Project
import com.intellij.testFramework.TestActionEvent

class RestartGaleActionTest : GaleTestCase() {
    private val restarted = mutableListOf<Project>()

    fun testRestartsGaleForTheEventsProject() {
        val action = RestartGaleAction { restarted += it }

        action.actionPerformed(TestActionEvent.createTestEvent(action, SimpleDataContext.getProjectContext(project)))

        assertEquals(listOf(project), restarted)
    }

    fun testDoesNothingWithoutAProject() {
        val action = RestartGaleAction { restarted += it }

        action.actionPerformed(TestActionEvent.createTestEvent(action, DataContext.EMPTY_CONTEXT))

        assertEmpty(restarted)
    }

    fun testIsRegisteredAsRestartGale() {
        val action = ActionManager.getInstance().getAction("Gale.Restart")

        assertInstanceOf(action, RestartGaleAction::class.java)
        assertEquals("Restart Gale", action.templateText)
        action.actionPerformed(TestActionEvent.createTestEvent(action, SimpleDataContext.getProjectContext(project)))
    }
}
