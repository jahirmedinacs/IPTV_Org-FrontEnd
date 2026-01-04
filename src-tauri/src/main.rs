// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    // FIX: Forzar GStreamer a buscar plugins en rutas del sistema si no están definidos
    // Esto ayuda a que el AppImage encuentre codecs H264/MP4 del sistema host
    #[cfg(target_os = "linux")]
    {
        // Estrategia 1: Intentar preguntar a pkg-config (más fiable si está instalado)
        let output = Command::new("pkg-config")
            .args(&["--variable=pluginsdir", "gstreamer-1.0"])
            .output();

        let mut path = String::new();

        if let Ok(o) = output {
            if o.status.success() {
                path = String::from_utf8_lossy(&o.stdout).trim().to_string();
                println!("GStreamer encontrado via pkg-config: {}", path);
            }
        }

        // Estrategia 2: Escaneo de sistema (Fallback tipo 'whereis')
        if path.is_empty() {
            let candidates = [
                "/usr/lib/gstreamer-1.0",
                "/usr/lib/x86_64-linux-gnu/gstreamer-1.0",
                "/lib/gstreamer-1.0",
                "/usr/local/lib/gstreamer-1.0",
            ];

            for c in candidates {
                if Path::new(c).exists() {
                    if !path.is_empty() {
                        path.push_str(":");
                    }
                    path.push_str(c);
                }
            }
            println!("GStreamer encontrado via scan: {}", path);
        }

        if !path.is_empty() && env::var("GST_PLUGIN_SYSTEM_PATH").is_err() {
            env::set_var("GST_PLUGIN_SYSTEM_PATH", &path);
            println!("Linux: Injecting GST_PLUGIN_SYSTEM_PATH={}", path);
        }
    }

    tauri_app_lib::run()
}
