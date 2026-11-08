/// Called from the app as `commands.greet({ name })` (app/commands.ts).
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

/// The password of the secure-storage vault (a Stronghold snapshot): a random secret that lives in
/// the operating system's keyring, created on first use. `@kitr/secure-storage` calls it as
/// `invoke('kitr_vault_key')`.
#[tauri::command]
fn kitr_vault_key(app: tauri::AppHandle) -> Result<String, String> {
    let entry = keyring::Entry::new(&app.config().identifier, "kitr-vault").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(secret) => Ok(secret),
        Err(keyring::Error::NoEntry) => {
            let bytes: [u8; 32] = rand::random();
            let secret: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            entry.set_password(&secret).map_err(|e| e.to_string())?;
            Ok(secret)
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            use tauri::Manager;
            // Secure storage: an encrypted Stronghold snapshot, its key derived with Argon2 from the keyring secret.
            let salt = app.path().app_local_data_dir()?.join("salt.txt");
            app.handle().plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt).build())?;
            // The updater needs `plugins.updater` (a public key and endpoints) in tauri.conf.json: it is
            // only registered when you have added it, so a new app starts without one.
            #[cfg(desktop)]
            if app.config().plugins.0.contains_key("updater") {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            // `kitr dev` sets KITR_DEVTOOLS from the platform's `devtools` option.
            #[cfg(debug_assertions)]
            if std::env::var("KITR_DEVTOOLS").as_deref() == Ok("1") {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, kitr_vault_key])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
