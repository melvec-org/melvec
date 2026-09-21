# Melvec Face Extractor (`melvec-face`)

Native C++ face extraction backend for Melvec.

## Pipeline

```text
Video
  ↓
FFmpeg frame decoding
  ↓
YuNet face detection
  ↓
Quality filtering
  ↓
SFace alignment + feature extraction
  ↓
Identity grouping
  ↓
Best representative selection
  ↓
Temporary non-representative cleanup
  ↓
Selected ExtractedFace results
```

The current executable does **not** persist faces to the Melvec
database. Database persistence is a later stage.

## Source layout

```text
native/face/
├── CMakeLists.txt
├── src/
│   ├── main.cpp
│   ├── face_extractor.cpp
│   ├── face_extractor.h
│   ├── face_quality.cpp
│   ├── face_quality.h
│   ├── face_grouping.cpp
│   ├── face_grouping.h
│   ├── ffmpeg_video_reader.cpp
│   └── ffmpeg_video_reader.h
bin/models/
    ├── face_detection_yunet_2026may.onnx
    └── face_recognition_sface_2021dec_int8bq.onnx
```

## Responsibilities

### `main.cpp`

CLI entry point. Creates `FaceExtractor`, runs extraction, and reports
results/progress. Keep algorithmic code out of this file.

### `face_extractor.cpp/.h`

Orchestrates the complete extraction pipeline:

1.  Open the video through `FFmpegVideoReader`.
2.  Configure YuNet.
3.  Sample frames.
4.  Detect faces.
5.  Apply quality filters.
6.  Align accepted faces with SFace.
7.  Extract the SFace feature.
8.  Save a temporary aligned face image.
9.  Group observations with `FaceGrouping`.
10. Select one representative per group.
11. Delete non-representative temporary images.
12. Return only the representatives.

### `face_quality.cpp/.h`

Determines whether a detected face is good enough to keep and calculates
the quality score.

Current thresholds:

```cpp
MIN_CONFIDENCE = 0.80
MIN_FACE_WIDTH = 80
MIN_FACE_HEIGHT = 80
MIN_SHARPNESS = 300.0
MAX_YAW_DEGREES = 65.0
```

Current quality weights:

```text
confidence  30%
size        20%
sharpness   30%
yaw         20%
```

Quality is for **observation quality**, not identity.

### `face_grouping.cpp/.h`

Determines which accepted observations belong to the same person.

It uses SFace cosine similarity and complete-link hierarchical
clustering.

Current threshold:

```cpp
GROUP_SIMILARITY_THRESHOLD = 0.30f;
```

For two clusters, complete-link similarity is the **lowest** pairwise
similarity between observations across the two clusters. Clusters merge
only when that value reaches the threshold.

This file should remain focused on grouping. It should not perform
database persistence, subject assignment, or permanent file management.

### `ffmpeg_video_reader.cpp/.h`

Reads video frames by invoking FFmpeg directly and returning BGR OpenCV
matrices.

OpenCV `VideoCapture` is intentionally not used. This avoids coupling
video decoding to the FFmpeg version linked into the Homebrew/OpenCV
installation.

The conceptual FFmpeg command is:

```text
ffmpeg -v error -i <video> -f rawvideo -pix_fmt bgr24 -
```

## Build

The development environment uses Homebrew OpenCV.

```bash
brew --prefix opencv
```

Configure and build:

```bash
cd native/face
cmake .
cmake --build . -j
```

If CMake cannot locate OpenCV automatically in your Homebrew setup, use:

```bash
cd native/face
mkdir -p build
cd build

cmake .. -DOpenCV_DIR="$(brew --prefix opencv)/lib/cmake/opencv5"
cmake --build . --config Release
```

The resulting executable is normally:

```text
native/face/melvec-face
```

When using the out-of-source `build/` directory flow above, the resulting executable is normally:

```text
native/face/build/melvec-face
```

The CMake target currently uses:

```cmake
add_executable(
    melvec-face
    src/main.cpp
    src/face_extractor.cpp
    src/face_quality.cpp
    src/face_grouping.cpp
    src/ffmpeg_video_reader.cpp
)
```

Required OpenCV components include:

```text
opencv_core
opencv_imgproc
opencv_imgcodecs
opencv_dnn
opencv_objdetect
```

`opencv_videoio` is intentionally not required.

## Models

### YuNet

Current development model:

```text
face_detection_yunet_2026may.onnx
```

YuNet supplies the face bounding box, confidence, and five landmarks.

### SFace

Current model:

```text
face_recognition_sface_2021dec_int8bq.onnx
```

SFace supplies alignment, feature extraction, and similarity matching.

Current features are:

```text
CV_32FC1
1 × 128
128 floats
```

`ExtractedFace` retains both:

```cpp
cv::Mat feature;
std::vector<float> embedding;
```

The `cv::Mat` is used by OpenCV SFace matching during grouping. The
float vector is intended for later database persistence.

## Running

The exact command-line argument order is defined by `main.cpp`. The
general development invocation is:

```text
./melvec-face <ffmpeg> <yunet-model> <sface-model> <video> <output-directory>
```

Use the actual CLI implemented in `main.cpp` when changing the
interface. Do not hard-code developer-specific paths.

## Algorithm

### 1. Detect

Frames are sampled at the configured interval (currently 1 second by
default). YuNet detects all faces in each sampled frame.

Each detection records:

```text
bounding box
confidence
five landmarks
frame index
timestamp
```

### 2. Filter

A detection is rejected when it fails the current quality criteria:

```text
confidence < 0.80
face width < 80
face height < 80
sharpness < 300
absolute yaw > 65°
```

Sharpness is calculated using variance of the Laplacian.

Yaw is an approximate solvePnP-based pose estimate. It is a quality
signal only and should not be treated as ground truth.

### 3. Extract identity features

Accepted faces are aligned using SFace and converted into a
128-dimensional feature.

### 4. Group

All accepted observations are compared using SFace cosine similarity.

The current grouping algorithm is complete-link hierarchical clustering:

```text
Each observation starts as its own group.
        ↓
Find the two groups with highest complete-link similarity.
        ↓
Merge if similarity >= 0.30.
        ↓
Repeat.
```

The goal is:

```text
many observations
      ↓
one group per person
```

### 5. Select

For each identity group, `selectBest()` chooses the observation with the
highest quality score.

The goal is:

```text
Person A → one best face
Person B → one best face
...
```

It does not choose identity. Grouping already established identity.

### 6. Cleanup

Every accepted observation initially has a temporary face image.

After representatives are selected:

```text
representative image → keep
other observation images → delete
```

The extractor then returns only the selected `ExtractedFace` objects.

## Known successful baseline

A development test produced:

```text
14 accepted observations
2 identity groups
2 representatives
```

Groups:

```text
Group 0:
0 3 5 6 8 10 11 13

Group 1:
1 2 4 7 9 12
```

Representatives:

```text
Group 0 → observation 13 → frame 225 → quality 0.8723
Group 1 → observation 7  → frame 125 → quality 0.8821
```

Twelve temporary non-representative images were deleted.

This is the current behavioral baseline.

When changing the algorithm, retain enough output to identify:

- which faces were detected;
- why a face was rejected;
- quality values;
- feature dimensions;
- similarity/grouping decisions;
- selected representatives.

The OpenCV warning:

```text
setPreferableTarget Targets are not supported by the new graph engine for now
```

has occurred during successful extraction. It concerns DNN
target/backend support and is not by itself an extraction failure. First
verify detections, features, and the final result before changing the
pipeline.

Useful macOS checks:

```bash
file melvec-face
otool -L melvec-face
otool -l melvec-face | grep -A2 LC_RPATH
```

## Packaging

The intended macOS architecture layout is:

```text
Resources/bin/
├── mac/
│   ├── arm64/
│   │   └── melvec-face
│   └── x64/
│       └── melvec-face
├── opencv/
│   ├── arm64/
│   │   └── *.dylib
│   └── x64/
│       └── *.dylib
└── models/
    ├── yunet.onnx
    └── sface.onnx
```

The Electron application should select the native executable matching
the current architecture.

When packaging dynamic libraries, use `@loader_path`-based rpaths so the
executable can locate its bundled OpenCV libraries.

Example:

```cmake
set_target_properties(
    melvec-face
    PROPERTIES
    BUILD_RPATH "@loader_path/opencv"
    INSTALL_RPATH "@loader_path/opencv"
)
```

The exact final packaging layout may change.

## Source control

Keep:

```text
CMakeLists.txt
src/*.cpp
src/*.h
README.md
```

Normally do not commit:

```text
build/
*.o
temporary face thumbnails
generated executables
developer-specific absolute paths
```

Model files may be handled separately depending on repository size and
redistribution requirements.

For every distributed model, document its exact source, version,
license, input/output requirements, and redistribution terms.

## Future database integration

Persistence is intentionally outside the current extractor.

The intended permanent table is:

```sql
CREATE TABLE faces (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    embedding BLOB NOT NULL
);
```

Relationships will be separate:

```text
face_images
face_videos
subject_faces
image_subjects
video_subjects
```

A detected face and a Melvec subject are different concepts:

```text
face
    = selected visual face representation

subject
    = user-defined identity
```

Do not automatically create a subject merely because a face was
detected.

Permanent face IDs are also a later step. They should be derived from
the selected face image using Melvec's existing image-hash/Base32
mechanism, rather than using frame number or detection index as the
permanent ID.

## Optimization guidance

Do not optimize until behavior is validated with multiple real videos.

Potential future areas:

### Similarity memory

The current grouping creates an `N × N` similarity matrix. For very
large observation counts this can consume significant memory.

### Grouping speed

Complete-link clustering can repeatedly evaluate cluster relationships.
A future implementation could cache/update cluster similarities rather
than recomputing them.

### Disk I/O

Every accepted observation currently produces a temporary image. A
future implementation could reduce temporary disk writes, but keeping
them during development is useful for debugging.

### Sampling

The current default is one sample per second. Adaptive sampling,
tracking, or scene-aware sampling may reduce processing cost, but
changes must be evaluated for their effect on identity grouping.

### Representative selection

The current rule is highest quality. It can later incorporate additional
signals such as frontal pose, sharpness, face size, and embedding
stability without changing the grouping stage.

## Testing

At minimum test:

```text
One person
    → 1 group / 1 representative

Two people
    → 2 groups / 2 representatives

Same person changing pose
    → same group

Same person at different distances
    → same group

Two visually similar people
    → separate groups

Very blurry video
    → poor observations rejected

Long video
    → benchmark CPU, memory, FFmpeg, SFace, grouping
```

When changing a threshold, use the same baseline video first and
compare:

```text
detections
rejections
accepted observations
similarity values
groups
representatives
```

Change one major parameter at a time.

## Architectural rule

Always identify which stage a change belongs to:

```text
DETECT
FILTER
GROUP
SELECT
PERSIST
```

Keep these responsibilities separate.

```text
Detection
    Is there a face?

Quality
    Is this observation good enough?

Grouping
    Which observations belong to the same person?

Selection
    Which observation best represents that person?

Persistence
    How should the selected face be stored?
```

A problem with blurry thumbnails belongs primarily to `face_quality` or
representative selection.

A problem with missed faces belongs to detection or sampling.

A problem with two people being merged belongs to SFace
similarity/grouping.

A problem with a correct face being stored incorrectly belongs to
persistence.

This separation is the core design principle of `melvec-face`.

## Output JSON contract

`melvec-face` should emit a single JSON object with this shape.

### Success

```json
{
  "status": "success",
  "data": {
    "sourceURL": "<input video URL or path>",
    "faces": [
      {
        "id": "<face id>",
        "imagePath": "<saved representative image path>",
        "confidence": 0.98,
        "quality": 0.91,
        "embedding": [0.123, -0.456]
      }
    ]
  }
}
```

### Failure

```json
{
  "status": "failure",
  "data": {
    "sourceURL": "<input video URL or path>",
    "error": {
      "code": "<stable machine-readable error code>",
      "message": "<human-readable error message>"
    }
  }
}
```

Rules:

- `status` must be either `success` or `failure`.
- On `success`, `data.faces` must be present and `data.error` must be omitted.
- On `failure`, `data.error` must be present and `data.faces` must be omitted.
- `confidence` is the detection confidence from YuNet.
- `quality` is the computed observation quality score.
- `embedding` is the extracted SFace feature as a float array.
- `imagePath` points to the selected representative face image.
