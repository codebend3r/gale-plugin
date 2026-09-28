package com.codebend3r.gale.ide

import com.codebend3r.gale.generated.GaleFacts
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key

internal val MISSING_BINARY_NOTIFIED = Key.create<Boolean>("gale.missingBinaryNotified")

/** Shows the missing-binary error once per project session, with an Open Settings action. */
class MissingBinaryNotifier(
    private val openSettings: (Project) -> Unit = ::openGaleSettings,
) {
    fun notify(project: Project) {
        if (project.getUserData(MISSING_BINARY_NOTIFIED) == true) {
            return
        }
        project.putUserData(MISSING_BINARY_NOTIFIED, true)
        NotificationGroupManager
            .getInstance()
            .getNotificationGroup("Gale")
            .createNotification(GaleFacts.MISSING_BINARY_MESSAGE, NotificationType.ERROR)
            .addAction(NotificationAction.createSimpleExpiring("Open settings") { openSettings(project) })
            .notify(project)
    }
}
