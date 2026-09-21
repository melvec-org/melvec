const createTables = (db) => {
    const subjectsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subjects'").get();

    if (!subjectsTableExists) {
        db.exec(`
        CREATE TABLE subjects (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        );
    `);
    }

    const videoSubjectsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_subjects'").get();

    if (!videoSubjectsTableExists) {
        db.exec(`
        CREATE TABLE video_subjects (
            video_id TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            PRIMARY KEY (video_id, subject_id),
            FOREIGN KEY (video_id) REFERENCES videos(id),
            FOREIGN KEY (subject_id) REFERENCES subjects(id)
        );
    `);

        db.exec(`
        CREATE INDEX idx_video_subjects_subject_id
        ON video_subjects(subject_id);
    `);
    }

    const imageSubjectsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='image_subjects'").get();

    if (!imageSubjectsTableExists) {
        db.exec(`
        CREATE TABLE image_subjects (
            image_id TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            PRIMARY KEY (image_id, subject_id),
            FOREIGN KEY (image_id) REFERENCES images(id),
            FOREIGN KEY (subject_id) REFERENCES subjects(id)
        );
    `);

        db.exec(`
        CREATE INDEX idx_image_subjects_subject_id
        ON image_subjects(subject_id);
    `);
    }

    // subject_candiates

    const subjectCandidatesTableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subjects_candidates'")
        .get();
    if (!subjectCandidatesTableExists) {
        db.exec(`
        CREATE TABLE subjects_candidates (
            id INTEGER PRIMARY KEY,
            status TEXT NOT NULL
        );
    `);
    }

    // subjects_candidates__images
    const subjectCandidatesImagesTableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subject_candidates_images'")
        .get();

    if (!subjectCandidatesImagesTableExists) {
        db.exec(`
        CREATE TABLE subject_candidates_images (
            candidate_id INTEGER NOT NULL,
            image_id TEXT NOT NULL,
            PRIMARY KEY (candidate_id, image_id)
        );
    `);
    }

    // subjects_candidates__videos
    const subjectCandidatesVideosTableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subject_candidates_videos'")
        .get();

    if (!subjectCandidatesVideosTableExists) {
        db.exec(`
        CREATE TABLE subject_candidates_videos (
            candidate_id INTEGER NOT NULL,
            video_id TEXT NOT NULL,
            PRIMARY KEY (candidate_id, video_id)
        );
    `);
    }

    const subjectFacesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subject_faces'").get();

    if (!subjectFacesTableExists) {
        db.exec(`
        CREATE TABLE subject_faces (
            subject_id INTEGER NOT NULL,
            face_id TEXT NOT NULL,
            PRIMARY KEY (subject_id, face_id),
            FOREIGN KEY (subject_id) REFERENCES subjects(id)
        );

        CREATE INDEX idx_subject_faces_subject_id
        ON subject_faces(subject_id);
    `);
    }

    const facesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='faces'").get();

    if (!facesTableExists) {
        db.exec(`
        CREATE TABLE faces (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            embedding BLOB NOT NULL
        );
    `);
    }
};
const createIndexes = (db) => {
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_video_subjects_subject_id
        ON video_subjects(subject_id);

        CREATE INDEX IF NOT EXISTS idx_image_subjects_subject_id
        ON image_subjects(subject_id);

        CREATE INDEX IF NOT EXISTS idx_subject_candidates_images_candidate_id
        ON subject_candidates_images(candidate_id);

        CREATE INDEX IF NOT EXISTS idx_subject_candidates_videos_candidate_id
        ON subject_candidates_videos(candidate_id);

        CREATE INDEX IF NOT EXISTS idx_subject_faces_subject_id
        ON subject_faces(subject_id);
    `);
};

module.exports = {
    createTables,
    createIndexes,
};
