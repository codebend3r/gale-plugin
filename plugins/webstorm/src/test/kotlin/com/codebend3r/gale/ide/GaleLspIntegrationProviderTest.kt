package com.codebend3r.gale.ide

import com.codebend3r.gale.core.Os
import com.codebend3r.gale.core.PathSettings
import com.codebend3r.gale.core.Platform
import com.codebend3r.gale.generated.GaleFacts
import com.intellij.notification.Notification
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.impl.SimpleDataContext
import com.intellij.openapi.project.Project
import com.intellij.platform.lsp.api.LspClientDescriptor
import com.intellij.platform.lsp.api.LspIntegrationProvider
import com.intellij.testFramework.LightVirtualFile
import com.intellij.testFramework.TestActionEvent

class GaleLspIntegrationProviderTest : GaleTestCase() {
    private val started = mutableListOf<LspClientDescriptor>()
    private val openedSettings = mutableListOf<Project>()
    private val starter =
        object : LspIntegrationProvider.LspClientStarter {
            override fun ensureClientStarted(descriptor: LspClientDescriptor) {
                started += descriptor
            }
        }

    private fun provider(locator: BinaryLocator = FakeLocator()) =
        GaleLspIntegrationProvider(Platform(Os.DARWIN, "arm64"), locator, MissingBinaryNotifier { openedSettings += it })

    private fun startedDescriptor(): GaleClientDescriptor = started.single() as GaleClientDescriptor

    fun testStartsTheClientWithTheResolvedCommandArgsAndWorkingDirectory() {
        settings.state.binaryPath = "/opt/gale/bin/gale"
        settings.state.configPath = "config/gale.json"

        provider().fileOpened(project, LightVirtualFile("a.scss"), starter)

        val commandLine = startedDescriptor().createCommandLine()
        assertEquals(listOf("/opt/gale/bin/gale", "--lsp", "--config", "config/gale.json"), commandLine.getCommandLineList(null))
        assertEquals(project.basePath, commandLine.workDirectory?.path)
    }

    fun testTheClientCoversGaleFilesOnly() {
        provider(FakeLocator(onPath = "/usr/bin/gale")).fileOpened(project, LightVirtualFile("a.css"), starter)

        val descriptor = startedDescriptor()
        assertEquals("/usr/bin/gale", descriptor.command)
        assertTrue(descriptor.isSupportedFile(LightVirtualFile("b.less")))
        assertFalse(descriptor.isSupportedFile(LightVirtualFile("b.ts")))
    }

    fun testDoesNothingForFilesGaleDoesntLint() {
        settings.state.binaryPath = "/opt/gale/bin/gale"

        provider().fileOpened(project, LightVirtualFile("a.ts"), starter)

        assertEmpty(started)
    }

    fun testDoesNothingWhenDisabled() {
        settings.state.enabled = false
        settings.state.binaryPath = "/opt/gale/bin/gale"

        provider().fileOpened(project, LightVirtualFile("a.css"), starter)

        assertEmpty(started)
        assertEmpty(notifications)
    }

    fun testReportsAMissingBinaryOnceWithoutStartingAClient() {
        provider().fileOpened(project, LightVirtualFile("a.css"), starter)
        provider().fileOpened(project, LightVirtualFile("b.css"), starter)
        flushEvents()

        assertEmpty(started)
        val notification = notifications.single()
        assertEquals(GaleFacts.MISSING_BINARY_MESSAGE, notification.content)
        assertEquals(NotificationType.ERROR, notification.type)
    }

    fun testTheMissingBinaryNotificationOpensGalesSettings() {
        provider().fileOpened(project, LightVirtualFile("a.css"), starter)
        flushEvents()

        val notification: Notification = notifications.single()
        val action = notification.actions.single() as NotificationAction
        assertEquals("Open settings", action.templateText)
        val event = TestActionEvent.createTestEvent(action, SimpleDataContext.getProjectContext(project))
        action.actionPerformed(event, notification)

        assertEquals(listOf(project), openedSettings)
        assertTrue(notification.isExpired)
    }

    fun testTheDefaultProviderCanBeCreatedByThePlatform() {
        settings.state.binaryPath = "/opt/gale/bin/gale"

        GaleLspIntegrationProvider().fileOpened(project, LightVirtualFile("a.css"), starter)

        assertEquals(PathSettings("", "/opt/gale/bin/gale"), settings.pathSettings)
        assertEquals("/opt/gale/bin/gale", startedDescriptor().command)
    }
}
