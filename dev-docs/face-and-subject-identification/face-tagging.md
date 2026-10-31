# Melvec Face Identification

## 1. Purpose

Melvec uses face detection and face recognition to identify recurring faces across a user's image and video library.

The purpose of face identification is to transform a large number of raw face observations into a small, manageable set of face representations that can later be associated with Melvec subjects.

The system is designed for large libraries where the same person may appear:

- across thousands of images
- across thousands of videos
- at different ages
- with different hairstyles
- with or without glasses
- with different facial hair
- under different lighting conditions
- at different camera angles

The system should minimize manual intervention while allowing the user to make the final identity decision.

---

## 2. Core Principle

A detected face is **not an identity**.

A face is an observation that provides evidence toward identifying a subject.

```text
Face detection
      ↓
Face embedding
      ↓
Similarity matching
      ↓
Candidate reduction
      ↓
Clustering
      ↓
User validation
      ↓
Subject
```

The face-identification system is therefore a recognition pipeline. It is not the permanent identity model.

---

## 3. Recognition vs Identity

The face-identification system answers:

> Which detected faces are likely to represent the same real-world subject?

It does **not** answer:

> What should this person's name be?

Naming and identity management belong to the Subject Management layer.

```text
Face Identification
        ↓
Possible same-subject cluster
        ↓
User validation
        ↓
Subject Management
        ↓
"Rahul"
```

---

## 4. Face Processing Data

Face processing can produce considerably more information than the permanent Melvec subject model needs.

The recognition workspace may contain:

- face thumbnail
- face ID
- face embedding
- quality score
- candidate status
- cluster information
- media associations

This information exists primarily to support recognition and validation.

It should remain separate from the permanent subject-management data.

### Media face extraction status

The `videos.face_extraction_status` and `images.face_extraction_status`
columns store the media-level face extraction result. This status answers
whether extraction ran and whether the native extractor found face
candidates. It does not guarantee that subject candidates were persisted.
Downstream best-face selection may still discard every detected face.

The application code should use `src/constants/faceExtractionStatus.js`
instead of raw strings. The database stores compact four-character codes:

```text
NULL  → not started
proc  → processing / recoverable interrupted run
cfdt  → completed, at least one native face candidate detected
cnfd  → completed, no native face candidates detected
fail  → technical/runtime failure
```

Batch face extraction should only pick media where the status is `NULL`
or `proc`. It should not automatically retry `cfdt`, `cnfd`, or `fail`.

Manual retry may be offered for `cfdt` because it means faces were found,
but relaxed thresholds may be needed to produce usable subject candidates.
Manual retry should not be offered for `cnfd` or `fail`.

---

## 5. Face Thumbnail

For every useful face observation, Melvec creates a small face thumbnail.

Recommended size:

```text
96 × 96 pixels
```

The thumbnails are stored in a hidden/private Melvec folder.

Melvec already has a mechanism for generating a Base32 identifier from a file hash.

The resulting identifier becomes the `face_id`.

```text
Face thumbnail
      ↓
File hash
      ↓
Base32
      ↓
face_id
```

The hash is therefore an implementation mechanism for generating the face ID.

The database does not need a separate integer face identifier.

---

## 6. Face Embedding

Each useful face observation is converted into a numerical embedding.

The embedding is used for similarity comparison.

```text
Face image
    ↓
Face recognition model
    ↓
Face embedding
```

Embeddings are machine-recognition data.

They are not intended to be exposed to the user.

---

## 7. Bounding Boxes

Face detection normally produces a bounding box:

```text
x
y
width
height
```

Bounding boxes are useful during processing because they identify where the face is located inside an image or video frame.

However, they are not important to Melvec's primary user experience.

The user's typical requirement is:

> Rahul in 2020

not:

> Where exactly inside the video does Rahul appear?

Therefore:

- bounding boxes may be used during processing
- bounding boxes do not need to be stored permanently
- the subject model does not depend on bounding boxes

If Melvec later introduces a feature such as "jump to Rahul's appearance in this video", timestamp and bounding-box information can be added to a future recognition-event model.

---

## 8. Timestamps

A person can appear in thousands of frames:

```text
00:13 → Rahul
00:14 → Rahul
00:15 → Rahul
00:16 → Rahul
...
```

Storing every occurrence is unnecessary for the initial subject-search model.

The main search requirement is:

> Rahul in 2020

The media's existing capture date/timeline provides the required temporal context.

Therefore, per-frame timestamps are not required in the permanent subject model.

Timestamps can be introduced later if Melvec needs functionality such as:

> Show me where Rahul appears in this video.

---

## 9. Face Candidate Workspace

Face candidates are recognition records used while identifying subjects.

Conceptually:

```text
face_candidates
----------------
face_id
embedding
quality
status
```

A candidate represents a useful face observation.

It does not necessarily represent a unique person.

For example:

```text
Candidate A
Candidate B
Candidate C
```

may all ultimately represent Rahul.

---

## 10. Face-to-Media Associations

A face candidate can originate from many media items.

Media IDs should **not** be stored as a JSON array inside the candidate record.

Instead, use a junction table.

Conceptually:

```text
face_candidate_media
--------------------
face_id
media_id
```

Example:

```text
Face Candidate A
    │
    ├── image_001
    ├── image_004
    ├── video_023
    └── video_091
```

This allows media associations to be merged efficiently when face candidates are merged.

---

## 11. Video Face Reduction

Videos can generate enormous numbers of face observations.

For example:

```text
Video
  ↓
2,000 frames
  ↓
1,500 detected faces
```

Most of these observations may represent the same appearance.

Melvec should therefore reduce temporal duplicates before performing large-scale clustering.

Conceptually:

```text
Detected faces
      ↓
Quality filtering
      ↓
Temporal reduction
      ↓
Near-duplicate reduction
      ↓
Useful face candidates
```

The goal is to retain useful visual diversity rather than every frame.

---

## 12. Quality Filtering

Very poor face observations should not become useful candidates.

Examples include:

- extremely small faces
- severe blur
- extreme occlusion
- unusable lighting
- extreme pose
- incomplete face
- very poor resolution

Each candidate can have a quality score.

Example:

```text
Face A
quality = 0.72

Face B
quality = 0.94
```

Face B is a better representative.

---

## 13. Pass 1 — Candidate Reduction

The first recognition pass processes faces incrementally.

```text
Face detected
      ↓
Create 96 × 96 thumbnail
      ↓
Generate embedding
      ↓
Compare against existing candidates
```

If a new face is extremely similar to an existing candidate, it can be treated as a duplicate representation.

Initial target threshold:

```text
> 98% similarity
```

The threshold is primarily a **candidate-reduction threshold**.

It should not be interpreted as absolute proof that two faces belong to the same person.

---

## 14. Representative Face Replacement

When two candidates are sufficiently similar, Melvec should retain the better-looking representation.

Example:

```text
Existing candidate
quality = 0.78

New candidate
quality = 0.94

Similarity = 99.1%
```

The new candidate becomes the representative.

```text
Candidate A
    ↓
Candidate B is better
    ↓
Candidate B becomes representative
```

The old face asset can subsequently be removed.

---

## 15. Candidate Replacement Strategy

Replaced candidates should preferably not be physically deleted immediately.

During processing:

```text
Candidate A
status = replaced
replacement_id = B
```

After the processing pass:

```text
Cleanup
   ↓
Remove replaced candidates
   ↓
Remove obsolete thumbnails
   ↓
Remove obsolete embeddings
```

This makes large-scale processing safer.

For example:

```text
A → B
B → C
C → D
```

At the end of processing, only D needs to survive.

---

## 16. Pass 1 Example

A large library could initially produce:

```text
50,000 detected face observations
```

After:

```text
quality filtering
+
video temporal reduction
+
>98% candidate merging
```

the result might be:

```text
50,000 detections
        ↓
8,000 useful candidates
```

The exact numbers will vary depending on the user's library.

The important goal is to reduce frame-level observations into a manageable recognition dataset.

---

## 17. Pass 2 — Candidate Clustering

The remaining candidates are grouped into possible same-subject clusters.

A lower similarity threshold can be used for clustering.

Initial target:

```text
> 95% similarity
```

For example:

```text
Candidate 001
Candidate 007
Candidate 019
Candidate 042
Candidate 087
```

may form:

```text
Cluster A
```

The cluster means:

> These faces are likely to represent the same subject.

It does not automatically establish identity.

---

## 18. Why User Validation Is Required

Face similarity is not equivalent to identity certainty.

Two different people can look similar.

The same person can also look significantly different because of age and appearance.

Therefore:

```text
Machine recognition
        ↓
Possible same-subject cluster
        ↓
Human validation
        ↓
Confirmed subject
```

The user remains the final authority.

---

## 19. Representative Faces in a Cluster

The user should not be shown every candidate face.

A cluster may contain hundreds of candidates.

Instead, Melvec should select a small number of representative faces.

Selection should consider:

- image quality
- visual diversity
- different ages
- different appearances
- different useful conditions

For example:

```text
100 candidate faces
        ↓
Quality + visual diversity
        ↓
5–10 representative faces
        ↓
User validation
```

This gives the user enough information to recognize the person without overwhelming them.

---

## 20. Different Ages and Appearance

The same person may look very different over time.

Example:

```text
2005 → child
2012 → teenager
2020 → adult
2026 → beard
```

These should remain candidates for the same subject.

Age should not automatically create a new identity.

The media timeline already provides the temporal context.

The recognition system should retain enough visual diversity to recognize the same subject across major appearance changes.

---

## 21. Recognition Workspace Lifetime

The recognition workspace should not necessarily be deleted immediately after scanning.

It can contain:

- unnamed candidates
- pending clusters
- clusters awaiting validation
- representative face images
- embeddings
- processing state

This allows the user to continue the identification process later.

The recognition workspace can therefore be persistent while still remaining separate from the permanent subject model.

---

## 22. Incremental Recognition

Melvec should avoid reclustering the entire library every time new media is added.

Once subjects have been validated, a new face can be processed against existing subject representations.

Conceptually:

```text
New face
    ↓
Compare against known subjects
    │
    ├── Strong match → existing subject
    ├── Uncertain match → review
    └── No match → unknown candidate
```

Only genuinely new or uncertain candidates should require further clustering.

This is particularly important for libraries containing tens of thousands of videos.

---

## 23. Recognition Architecture

```text
                         MEDIA
                           │
                           ▼
                    FACE DETECTION
                           │
                           ▼
                    FACE EMBEDDING
                           │
                           ▼
                 QUALITY FILTERING
                           │
                           ▼
              VIDEO TEMPORAL REDUCTION
                           │
                           ▼
                    ┌────────────┐
                    │   PASS 1   │
                    │            │
                    │ >98% merge │
                    │ candidates │
                    └─────┬──────┘
                          │
                          ▼
                  FACE CANDIDATES
                          │
                          ▼
                    ┌────────────┐
                    │   PASS 2   │
                    │            │
                    │ >95% group │
                    │ candidates │
                    └─────┬──────┘
                          │
                          ▼
                    USER VALIDATION
                          │
                          ▼
                       SUBJECT
```

---

## 24. Core Design Goal

The face-identification pipeline should transform:

```text
50,000 face observations
```

into:

```text
A manageable set of candidates
        ↓
A manageable set of clusters
        ↓
A small number of user decisions
        ↓
Validated subjects
```

The user should never have to manually tag thousands of individual faces.

The system performs the computational work and asks the user only for decisions that require human judgment.
