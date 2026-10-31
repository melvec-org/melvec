const createIndexes = (db) => {
    if (!db) {
        throw new Error('Database is not initialized');
    }

    db.exec(`
        -- Fast lookup: all videos in a collection
        
        -- Fast filtering of hidden collections
        CREATE INDEX IF NOT EXISTS idx_collections_hidden 
            ON collections(isHidden);

        -- Fast playlist and tag lookups
        CREATE INDEX IF NOT EXISTS idx_playlists_videos_playlist_id 
            ON playlists_videos(playlist_id);

        CREATE INDEX IF NOT EXISTS idx_tags_videos_tag_id 
            ON tags_videos(tag_id);

        CREATE INDEX IF NOT EXISTS idx_tags_videos_video_id 
            ON tags_videos(video_id);

        CREATE INDEX IF NOT EXISTS idx_videos_collection_birthtime 
            ON videos(collection_id, birthtimeMs DESC);

        CREATE INDEX IF NOT EXISTS idx_videos_category_id 
            ON videos(category_id);

        CREATE INDEX IF NOT EXISTS idx_images_collection_id 
            ON images(collection_id);

        CREATE INDEX IF NOT EXISTS idx_image_videos_video_id 
            ON image_videos(video_id);

        CREATE INDEX IF NOT EXISTS idx_tags_images_image_id 
            ON tags_images(image_id);

        CREATE INDEX IF NOT EXISTS idx_audios_collection_id 
            ON audios(collection_id);

        CREATE INDEX IF NOT EXISTS idx_audio_videos_video_id 
            ON audio_videos(video_id);

        CREATE INDEX IF NOT EXISTS idx_tags_audios_audio_id 
            ON tags_audios(audio_id);

        CREATE INDEX IF NOT EXISTS idx_image_location_clusters_cluster
            ON image_location_clusters(cluster_id);

        CREATE INDEX IF NOT EXISTS idx_image_location_clusters_image
            ON image_location_clusters(image_id);

        CREATE INDEX IF NOT EXISTS idx_video_location_clusters_cluster
            ON video_location_clusters(cluster_id);

        CREATE INDEX IF NOT EXISTS idx_video_location_clusters_video
            ON video_location_clusters(video_id);
        
        CREATE INDEX IF NOT EXISTS idx_videos_year 
            ON videos(year DESC, birthtimeMs DESC);
    `);
};

module.exports = {
    createIndexes,
};
