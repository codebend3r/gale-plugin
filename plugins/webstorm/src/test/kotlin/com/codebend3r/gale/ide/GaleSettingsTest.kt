package com.codebend3r.gale.ide

import com.codebend3r.gale.core.PathSettings
import com.codebend3r.gale.generated.GaleFacts
import com.intellij.util.xmlb.XmlSerializer

class GaleSettingsTest : GaleTestCase() {
    fun testDefaultsComeFromTheSharedFacts() {
        val state = settings.state

        assertEquals(GaleFacts.ENABLE_DEFAULT, state.enabled)
        assertEquals(GaleFacts.CONFIG_PATH_DEFAULT, state.configPath.orEmpty())
        assertEquals(GaleFacts.BINARY_PATH_DEFAULT, state.binaryPath.orEmpty())
    }

    fun testSettingsSurviveASaveAndLoad() {
        settings.state.enabled = false
        settings.state.configPath = "config/gale.json"
        settings.state.binaryPath = "/opt/gale/bin/gale"

        val element = XmlSerializer.serialize(settings.state)
        val restored = GaleSettingsState()
        XmlSerializer.deserializeInto(restored, element)

        assertEquals(false, restored.enabled)
        assertEquals("config/gale.json", restored.configPath)
        assertEquals("/opt/gale/bin/gale", restored.binaryPath)
    }

    fun testPathSettingsAreTrimmed() {
        settings.state.configPath = " config/gale.json\n"
        settings.state.binaryPath = "  "

        assertEquals(PathSettings("config/gale.json", ""), settings.pathSettings)
    }

    fun testMissingPathSettingsCountAsUnset() {
        settings.state.configPath = null
        settings.state.binaryPath = null

        assertEquals(PathSettings("", ""), settings.pathSettings)
    }
}
