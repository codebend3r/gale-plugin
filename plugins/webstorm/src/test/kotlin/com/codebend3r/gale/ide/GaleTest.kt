package com.codebend3r.gale.ide

import com.codebend3r.gale.core.Os
import com.codebend3r.gale.core.PathSettings
import com.codebend3r.gale.core.Platform
import com.codebend3r.gale.core.Resolution
import com.codebend3r.gale.core.Source
import com.intellij.testFramework.LightVirtualFile
import java.nio.file.Files

class GaleTest : GaleTestCase() {
    private val macArm = Platform(Os.DARWIN, "arm64")
    private val noSettings = PathSettings("", "")

    fun testMapsJVMPlatformNamesOntoTheContractsNames() {
        assertEquals(Platform(Os.DARWIN, "arm64"), platformFor("Mac OS X", "aarch64"))
        assertEquals(Platform(Os.WIN32, "x64"), platformFor("Windows 11", "amd64"))
        assertEquals(Platform(Os.LINUX, "x64"), platformFor("Linux", "x86_64"))
        assertEquals(Platform(Os.LINUX, "arm64"), platformFor("Linux", "arm64"))
        assertEquals(Platform(Os.LINUX, "riscv64"), platformFor("FreeBSD", "riscv64"))
    }

    fun testReadsTheCurrentPlatformFromTheJVM() {
        assertEquals(platformFor(System.getProperty("os.name"), System.getProperty("os.arch")), currentPlatform())
    }

    fun testTheSystemLocatorChecksForRegularFiles() {
        val file = Files.createTempFile("gale", "")
        try {
            assertTrue(SystemBinaryLocator.isFile(file.toString()))
            assertFalse(SystemBinaryLocator.isFile(file.parent.toString()))
        } finally {
            Files.delete(file)
        }
    }

    fun testTheSystemLocatorSearchesPATH() {
        assertNotNull(SystemBinaryLocator.findOnPath("sh"))
        assertNull(SystemBinaryLocator.findOnPath("gale-binary-that-does-not-exist"))
    }

    fun testGaleFilesAreMatchedByExtensionIgnoringCase() {
        for (name in listOf("a.css", "a.scss", "a.less", "a.sass", "A.CSS")) {
            assertTrue(name, isGaleFile(LightVirtualFile(name)))
        }
        assertFalse(isGaleFile(LightVirtualFile("a.js")))
        assertFalse(isGaleFile(LightVirtualFile("Makefile")))
    }

    fun testResolvesTheProjectInstallUnderTheProjectBasePath() {
        val expected = "${project.basePath}/node_modules/@codebend3r/gale/bin/aarch64-apple-darwin/gale"

        val resolution = resolveGale(project, noSettings, macArm, FakeLocator(files = setOf(expected), onPath = "/usr/bin/gale"))

        assertEquals(Resolution.Found(Source.PROJECT, expected), resolution)
    }

    fun testFallsBackToPATH() {
        val resolution = resolveGale(project, noSettings, macArm, FakeLocator(onPath = "/usr/bin/gale"))

        assertEquals(Resolution.Found(Source.PATH, "/usr/bin/gale"), resolution)
    }

    fun testSkipsTheProjectProbeOnAPlatformWithNoRelease() {
        val locator =
            object : BinaryLocator {
                override fun isFile(path: String): Boolean = error("should not probe $path")

                override fun findOnPath(name: String): String? = null
            }

        assertEquals(Resolution.NotFound, resolveGale(project, noSettings, Platform(Os.WIN32, "arm64"), locator))
    }

    fun testRestartingWithNoRunningClientDoesNothing() {
        restartGale(project)
    }
}
