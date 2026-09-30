import kotlinx.kover.gradle.plugin.dsl.CoverageUnit
import org.jetbrains.intellij.platform.gradle.TestFrameworkType

plugins {
    id("org.jetbrains.kotlin.jvm") version "2.4.20"
    id("org.jetbrains.intellij.platform") version "2.19.0"
    id("org.jetbrains.kotlinx.kover") version "0.9.9"
    id("org.jlleitschuh.gradle.ktlint") version "14.2.0"
}

group = "com.codebend3r.gale"
version = "1.0.0"

kotlin {
    jvmToolchain(25)
    compilerOptions {
        allWarningsAsErrors = true
    }
}

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        // CI sets ideVersion to download WebStorm; locally the installed app is used.
        val ideVersion = providers.gradleProperty("ideVersion")
        if (ideVersion.isPresent) {
            webstorm(ideVersion.get())
        } else {
            local(providers.gradleProperty("idePath").orElse("/Applications/WebStorm.app"))
        }
        testFramework(TestFrameworkType.Platform)
    }
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.opentest4j:opentest4j:1.3.0")
}

intellijPlatform {
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "262"
            untilBuild = provider { null }
        }
    }
    buildSearchableOptions = false
}

tasks.test {
    // CI has no display. Run headless everywhere so a test that needs one fails locally too.
    systemProperty("java.awt.headless", "true")
}

kover {
    reports {
        filters {
            excludes {
                // openGaleSettings opens the modal Settings dialog, which throws
                // HeadlessException without a display, so no headless test can run it.
                classes("com.codebend3r.gale.ide.OpenGaleSettingsKt")
            }
        }
        verify {
            rule {
                bound {
                    minValue = 100
                    coverageUnits = CoverageUnit.LINE
                }
                bound {
                    minValue = 100
                    coverageUnits = CoverageUnit.BRANCH
                }
            }
        }
    }
}

ktlint {
    version.set("1.8.0")
}

// Unzips the built plugin into WebStorm's plugins folder. Restart WebStorm afterwards.
val installPlugin by tasks.registering(Copy::class) {
    group = "intellij platform"
    description = "Installs the plugin into a local WebStorm."
    val pluginsDir =
        providers
            .gradleProperty("pluginsDir")
            .orElse("${System.getProperty("user.home")}/Library/Application Support/JetBrains/WebStorm2026.2/plugins")
    from(tasks.buildPlugin.flatMap { it.archiveFile }.map { zipTree(it) })
    into(pluginsDir)
}
