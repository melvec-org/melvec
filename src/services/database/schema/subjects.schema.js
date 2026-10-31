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

    // subject_candiates

    const subjectCandidatesTableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subjects_candidates'")
        .get();
    if (!subjectCandidatesTableExists) {
        db.exec(`
        CREATE TABLE subjects_candidates (
            id INTEGER PRIMARY KEY,
            status TEXT NOT NULL CHECK (status IN ('pending', 'identified')),
            subject_id INTEGER,
            FOREIGN KEY (subject_id) REFERENCES subjects(id)
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
            PRIMARY KEY (candidate_id, image_id),
            FOREIGN KEY (candidate_id) REFERENCES subjects_candidates(id) ON DELETE CASCADE,
            FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
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
            PRIMARY KEY (candidate_id, video_id),
            FOREIGN KEY (candidate_id) REFERENCES subjects_candidates(id) ON DELETE CASCADE,
            FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        );
    `);
    }

    // subject_candidate_faces links unresolved subject candidate clusters to their extracted face records.
    const subjectCandidateFacesTableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subject_candidate_faces'")
        .get();

    if (!subjectCandidateFacesTableExists) {
        db.exec(`
        CREATE TABLE subject_candidate_faces (
            candidate_id INTEGER NOT NULL,
            face_id TEXT NOT NULL,
            is_representative INTEGER NOT NULL DEFAULT 1,
            representative_rank INTEGER,
            PRIMARY KEY (candidate_id, face_id),
            FOREIGN KEY (candidate_id) REFERENCES subjects_candidates(id) ON DELETE CASCADE,
            FOREIGN KEY (face_id) REFERENCES faces(id) ON DELETE CASCADE
        );
    `);
    }

    const facesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='faces'").get();

    if (!facesTableExists) {
        db.exec(`
        CREATE TABLE faces (
            id TEXT PRIMARY KEY,
            media_id TEXT NOT NULL,
            embedding BLOB NOT NULL,
            confidence REAL
        );

        CREATE INDEX idx_faces_media_id
            ON faces(media_id);
    `);
    }
};
const createIndexes = (db) => {
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_subject_candidates_images_candidate_id
        ON subject_candidates_images(candidate_id);

        CREATE INDEX IF NOT EXISTS idx_subject_candidates_images_image_id
        ON subject_candidates_images(image_id);

        CREATE INDEX IF NOT EXISTS idx_subject_candidates_videos_candidate_id
        ON subject_candidates_videos(candidate_id);

        CREATE INDEX IF NOT EXISTS idx_subject_candidates_videos_video_id
        ON subject_candidates_videos(video_id);

        CREATE INDEX IF NOT EXISTS idx_subject_candidates_subject_id
        ON subjects_candidates(subject_id);

        CREATE INDEX IF NOT EXISTS idx_subject_candidate_faces_candidate_id
        ON subject_candidate_faces(candidate_id);

        CREATE INDEX IF NOT EXISTS idx_subject_candidate_faces_face_id
        ON subject_candidate_faces(face_id);

        CREATE INDEX IF NOT EXISTS idx_subject_candidate_faces_representative_rank
        ON subject_candidate_faces(candidate_id, is_representative, representative_rank);

        CREATE INDEX IF NOT EXISTS idx_subject_faces_subject_id
        ON subject_faces(subject_id);
    `);
};

module.exports = {
    createTables,
    createIndexes,
};
