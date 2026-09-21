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

## 8. Subject Faces

A subject can have multiple representative faces.

This is important because appearance changes over time.

Example:

```text
Rahul
 ├── child appearance
 ├── teenage appearance
 ├── adult appearance
 └── older appearance
```

Use a junction table:

```text
subject_faces
-------------
subject_id
face_id
```

Example:

```text
subject_id | face_id
-----------|--------
101        | FACE_A
101        | FACE_B
101        | FACE_C
```

`face_id` refers to the face representation created by the Face Identification system.

---

## 9. Why Multiple Representative Faces?

A single face representation is insufficient for long-term recognition.

The same person can change because of:

- age
- hairstyle
- facial hair
- glasses
- weight
- lighting
- camera angle
- image quality

Therefore, a subject should have a small collection of representative face representations.

The objective is not to store every detected face.

The objective is to retain a useful set of distinct appearances.

---

## 10. Subject Face Selection

After user validation, Melvec should retain the strongest representative faces from the identified cluster.

For example:

```text
100 candidate faces
        ↓
quality + visual diversity
        ↓
5 representative faces
        ↓
subject_faces
```

A subject might therefore have:

```text
Rahul
 ├── FACE_A
 ├── FACE_B
 ├── FACE_C
 ├── FACE_D
 └── FACE_E
```

---

## 11. Subject-to-Media Associations

The most important permanent relationship is:

```text
Subject ↔ Media
```

This relationship enables natural-language media discovery.

Images and videos are maintained separately in Melvec.

Therefore, subject associations should also be maintained separately.

### `image_subjects`

```text
image_subjects
--------------
image_id
subject_id
```

The recommended primary key is:

```text
(image_id, subject_id)
```

This prevents duplicate associations.

### `video_subjects`

```text
video_subjects
--------------
video_id
subject_id
```

The recommended primary key is:

```text
(video_id, subject_id)
```

This prevents duplicate associations.

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

The database contains:

```text
video_subjects

video_001 | Rahul
video_001 | Sarah
video_001 | Mom
```

Likewise, one subject can be associated with many media items.

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

The search engine then uses:

```text
image_subjects
video_subjects
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
subject_faces
image_subjects
video_subjects
```

Conceptually:

```text
                    SUBJECT
                       │
                ┌──────┴──────┐
                │             │
                ▼             ▼
         SUBJECT_FACES      MEDIA
                              │
                   ┌──────────┴──────────┐
                   ▼                     ▼
            IMAGE_SUBJECTS       VIDEO_SUBJECTS
```

---

## 27. Recognition Workspace vs Permanent Model

### Recognition Workspace

```text
face_candidates
face_candidate_media
face_clusters
embeddings
temporary face assets
```

Used for:

- face recognition
- candidate reduction
- clustering
- representative face selection
- user validation

### Permanent Subject Model

```text
subjects
subject_faces
image_subjects
video_subjects
```

Used for:

- identity
- subject management
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
Face Identification
  ↓
Candidate Reduction
  ↓
Candidate Clustering
  ↓
User Validation
  ↓
Subject
  ↓
Subject Faces
  ↓
Subject ↔ Media Associations
  ↓
Search
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
