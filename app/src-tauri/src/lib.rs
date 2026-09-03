// phase 3 home for: folder watcher (originals immutable, checksum on write), mic capture, local embeddings.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running arkive");
}
