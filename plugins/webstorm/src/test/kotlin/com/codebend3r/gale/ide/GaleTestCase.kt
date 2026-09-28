package com.codebend3r.gale.ide

import com.intellij.notification.Notification
import com.intellij.notification.Notifications
import com.intellij.testFramework.PlatformTestUtil
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/** Resets Gale's project state between tests and records notifications. */
abstract class GaleTestCase : BasePlatformTestCase() {
    protected val notifications = mutableListOf<Notification>()

    protected val settings: GaleSettings
        get() = GaleSettings.getInstance(project)

    override fun setUp() {
        super.setUp()
        settings.loadState(GaleSettingsState())
        project.putUserData(MISSING_BINARY_NOTIFIED, null)
        project.messageBus.connect(testRootDisposable).subscribe(
            Notifications.TOPIC,
            object : Notifications {
                override fun notify(notification: Notification) {
                    if (notification.groupId == "Gale") {
                        notifications += notification
                    }
                }
            },
        )
    }

    protected fun flushEvents() {
        PlatformTestUtil.dispatchAllEventsInIdeEventQueue()
    }
}

class FakeLocator(
    private val files: Set<String> = emptySet(),
    private val onPath: String? = null,
) : BinaryLocator {
    override fun isFile(path: String): Boolean = path in files

    override fun findOnPath(name: String): String? = onPath
}
