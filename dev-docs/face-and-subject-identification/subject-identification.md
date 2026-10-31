# Melvec Subject Management

## 1. Purpose

Subject Management is the permanent identity layer of Melvec.

Face Identification determines which face observations appear to represent the same real-world entity.

Subject Management turns that recognition result into a user-defined identity.

Example:

```text
Face cluster
      ↓
User: "Rahul"
      ↓
Subject
```

The subject then becomes part of Melvec's permanent search model.

---

## 2. Subject vs Face

A **subject** represents the identity.

A **face** is visual evidence used to identify that identity.

```text
Subject
   │
   ├── Face representation A
   ├── Face representation B
   ├── Face representation C
   └── Face representation D
```

The same subject may have multiple face representations.

---

## 3. Generic Subject Model

The subject model should remain generic.

Do not require fields such as:

```text
type
gender
relationship
age
```

The user should not have to classify the subject.

The system should primarily capture what the user actually knows:

> This is Rahul.

This keeps the model simple and allows future recognition of other entity types, such as pets, without fundamentally changing the identity architecture.

Pets are outside the Phase 1 recognition scope.

---

## 4. User-Facing Terminology

The database uses the generic term:

```text
subjects
```

The Phase 1 user-facing UI should use:

```text
People
```

Example:

```text
People

Rahul
Sarah
Mom
```

The technical concept of "subject" does not need to be exposed to the user.

---

## 5. User Naming

Users should not be required to provide unnecessary information.

The primary interaction should be:

> Who is this?

The user enters:

```text
Rahul
```

The system should not require:

```text
Rahul - Brother
Rahul - Friend
Rahul - Colleague
```

It should also not require:

- age
- relationship
- gender
- occupation
- other classification

The user's name is sufficient.

---

## 6. Subjects With the Same Name

Two different people can legitimately have the same name.

Therefore, the subject name must not be globally unique.

Example:

```text
subjects

id    name
----  -----
101   Rahul
202   Rahul
```

The internal `subject_id` distinguishes the subjects.

The user does not have to provide a distinction during initial identification.

Optional distinction mechanisms can be introduced later if the user needs them.

---

## 7. Subjects Table

The basic table is intentionally small.

```text
subjects
--------
id
name
```

Example:

```text
101 | Rahul
102 | Sarah
103 | Rahul
```

The subject table represents the user's semantic identity model.

---

## 8. Subject Candidates as the Subject Evidence Layer

Subject candidates are permanent review/evidence records.

A candidate starts as `pending`. When the user identifies it, the same candidate is retained and linked to a subject:

```text
subjects_candidates
-------------------
id
status       -- pending | identified
subject_id   -- nullable until identified
```

This keeps the candidate's media membership and representative faces available after identification.

A subject can therefore have one or more identified candidate clusters:

```text
Subject Rahul
 ├── Candidate 17 -- childhood photos
 ├── Candidate 31 -- adult photos
 └── Candidate 44 -- beard/glasses appearance
```

---

## 9. Representative Candidate Faces

Melvec does not need to store every detected face forever.

A candidate should keep a small curated set of representative faces used for review, display, and recognition.

Representative state lives on the candidate-face relationship:

```text
subject_candidate_faces
-----------------------
candidate_id
face_id
is_representative
representative_rank
```

`representative_rank` is initially derived from detector confidence or quality heuristics, but the user can later reorder faces manually. Lower rank means better representative face.

---

## 10. Candidate Face Selection

After clustering or user validation, Melvec should retain the strongest representative faces for the candidate.

For example:

```text
100 detected faces
        ↓
quality + visual diversity + user curation
        ↓
5 representative faces
        ↓
subject_candidate_faces
```

The objective is not to store every detected face.

The objective is to retain a useful set of distinct appearances while preserving media membership separately.

---

## 11. Candidate-to-Media Associations

The durable media relationship is maintained at candidate level:

```text
Candidate ↔ Media
```

Images and videos are maintained separately in Melvec.

### `subject_candidates_images`

```text
subject_candidates_images
-------------------------
candidate_id
image_id
```

The primary key is:

```text
(candidate_id, image_id)
```

### `subject_candidates_videos`

```text
subject_candidates_videos
-------------------------
candidate_id
video_id
```

The primary key is:

```text
(candidate_id, video_id)
```

A subject's media is derived from identified candidates:

```text
subjects_candidates.status = identified
subjects_candidates.subject_id = subject id
subject_candidates_images / subject_candidates_videos
```

Direct `subject_faces`, `image_subjects`, and `video_subjects` tables are not part of the current model.

---

## 13. Multiple Subjects in One Media Item

A media item can contain multiple subjects.

Example:

```text
video_001
   ├── Rahul
   ├── Sarah
   └── Mom
```

The candidate-media tables contain the durable membership:

```text
subject_candidates_videos

candidate_17 | video_001
candidate_31 | video_001
candidate_44 | video_001
```

When those candidates are identified, `subjects_candidates.subject_id` resolves them to user-facing subjects.

Likewise, one subject can be associated with many media items through one or more identified candidates.

---

## 13. Face Identification vs Subject Management

The two systems should remain separate.

### Face Identification

Answers:

> Which faces appear to represent the same entity?

### Subject Management

Answers:

> What does the user want to call that entity?

Example:

```text
Face Identification
        ↓
Cluster 17
        ↓
User validation
        ↓
Subject Management
        ↓
"Rahul"
```

---

## 15. User Validation UX

The user should see representative faces rather than thousands of raw detections.

Example:

```text
Who is this?

┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│    │ │    │ │    │ │    │ │    │
└────┘ └────┘ └────┘ └────┘ └────┘

Appears in 1,284 items

[ Rahul________________ ]

[ Save ]
```

The interaction should be fast and lightweight.

The user should not need to understand face embeddings, clustering, similarity scores, or other technical details.

---

## 16. Unknown / Skip / Incorrect Cluster

The user should not be forced to assign a name.

Possible actions include:

```text
[ Name ]
[ Skip ]
[ Not the same person ]
[ Ignore ]
```

If the cluster is incorrect, the user should be able to reject or split it.

---

## 17. Same Subject Across Ages

Age is not a subject property.

For example:

```text
2005 → Rahul as child
2012 → Rahul as teenager
2020 → Rahul as adult
2026 → Rahul with beard
```

All of these can belong to the same subject:

```text
subject_id = 101
name = Rahul
```

The media timeline provides the temporal context.

The subject does not need fields such as:

```text
birth_year
age
age_at_photo
```

for the core functionality.

---

## 18. Subject Search

Once subject/media associations exist, face recognition is not required during normal search.

For example:

> Rahul in 2020

The intent analyzer resolves:

```text
Subject = Rahul
Time = 2020
```

The search engine then uses identified candidate media:

```text
subjects_candidates.status = identified
subjects_candidates.subject_id = Rahul's subject id
subject_candidates_images / subject_candidates_videos
```

together with the normal media and time indexes.

Conceptually:

```text
User Query
    ↓
Intent Analyzer
    ↓
Subject = Rahul
Time = 2020
    ↓
Subject/Media Associations
    ↓
Media Results
```

---

## 19. Subject Search Does Not Require Face Data

Normal search should not need:

- face embeddings
- face thumbnails
- face bounding boxes
- per-frame timestamps
- face clusters
- recognition candidates

Those belong to the Face Identification system.

The search system primarily needs:

```text
subject_id
+
media_id
```

This keeps subject search simple and fast.

---

## 20. People UI

A simple People screen could show:

```text
People

┌──────────┐
│          │
│   FACE   │
│          │
└──────────┘
Rahul
1,284 items

┌──────────┐
│          │
│   FACE   │
│          │
└──────────┘
Sarah
642 items
```

The primary visual representation should be a good face thumbnail.

---

## 21. Subject Detail UI

Selecting a person can show:

```text
Rahul

Representative faces

[face] [face] [face] [face]

Media

1,284 items
```

The representative faces allow the user to understand which person the subject represents.

---

## 22. Subject Editing

The user should be able to:

- rename a subject
- merge subjects
- split subjects
- remove a subject from media
- add/remove representative faces
- review associated media

The system should make these actions simple and reversible where possible.

---

## 23. Subject Rename

Renaming is straightforward:

```text
Rahul
   ↓
Rename
   ↓
Rahul Kumar
```

All existing media associations remain unchanged.

Only the subject's name changes.

---

## 24. Subject Merge

If the user realizes:

```text
Rahul A
Rahul B
```

are actually the same person, the system should allow them to merge the subjects.

Before:

```text
Subject 101
   ├── Face A
   ├── Face B
   └── Media

Subject 202
   ├── Face C
   ├── Face D
   └── Media
```

After:

```text
Subject 101
   ├── Face A
   ├── Face B
   ├── Face C
   ├── Face D
   └── All associated media
```

Duplicate media associations are prevented by the composite primary keys of the junction tables.

---

## 25. Subject Split

If a cluster was incorrectly identified:

```text
Rahul
 ├── Person A faces
 └── Person B faces
```

the user should eventually be able to split the subject.

This may produce:

```text
Rahul
Rahul
```

The user can rename either subject later.

The underlying data model should not assume that names are unique.

---

## 26. Permanent Data Model

The core permanent tables are:

```text
subjects
subjects_candidates
subject_candidate_faces
subject_candidates_images
subject_candidates_videos
```

Conceptually:

```text
                    SUBJECT
                       │
                       ▼
              IDENTIFIED CANDIDATES
                │                 │
                ▼                 ▼
       REPRESENTATIVE FACES      MEDIA
                │                 │
                ▼                 ▼
     SUBJECT_CANDIDATE_FACES   SUBJECT_CANDIDATES_IMAGES / SUBJECT_CANDIDATES_VIDEOS
```

---

## 27. Recognition Workspace vs Permanent Model

Subject candidates are no longer throwaway recognition workspace records. They are the permanent evidence layer for both pending and identified subject clusters.

### Candidate Evidence Model

```text
subjects
subjects_candidates
subject_candidate_faces
subject_candidates_images
subject_candidates_videos
faces
```

Used for:

- identity
- pending candidate review
- identified subject management
- representative face selection
- media discovery
- natural-language search

---

## 28. Data Flow

The complete flow is:

```text
Media
  ↓
Face Detection
  ↓
Candidate Reduction
  ↓
Candidate Clustering
  ↓
Candidate Media Association
  ↓
Representative Face Selection
  ↓
User Validation
  ↓
Candidate marked identified + linked to Subject
  ↓
Search derives Subject ↔ Media through identified candidates
```

---

## 29. Key UX Principle

The user should never need to think about:

```text
face embeddings
face clusters
similarity thresholds
bounding boxes
timestamps
candidate IDs
```

The user experience should simply be:

```text
People
   ↓
"This is Rahul"
   ↓
Done
```

The technical complexity remains behind the scenes.

---

## 30. Phase 1 Scope

Phase 1 includes:

- People UI
- generic `subjects` model
- face-based recognition
- multiple representative faces
- user-defined names
- duplicate names allowed
- subject ↔ face relationship
- subject ↔ image relationship
- subject ↔ video relationship
- natural-language subject search
- subject merge
- subject split
- subject rename

Pets are not part of Phase 1 recognition.

However, the underlying subject model remains generic enough that future pet recognition can reuse the same identity and media-association architecture.
