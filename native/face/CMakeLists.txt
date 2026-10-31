cmake_minimum_required(VERSION 3.16)

project(melvec-face)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenCV REQUIRED)

add_executable(
    melvec-face
    src/main.cpp
    src/face_extractor.cpp
    src/face_quality.cpp
    src/face_grouping.cpp
    src/ffmpeg_video_reader.cpp
    src/ffmpeg_batch_video_reader.cpp
)

set_target_properties(
    melvec-face
    PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/../../bin/mac"
)

target_include_directories(
    melvec-face
    PRIVATE
    ${OpenCV_INCLUDE_DIRS}
)

target_link_libraries(
    melvec-face
    PRIVATE
    opencv_core
    opencv_imgproc
    opencv_imgcodecs
    opencv_dnn
    opencv_objdetect
)