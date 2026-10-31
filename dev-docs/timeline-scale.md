# Timeline scale visualization

This document describes the density visualization implemented by `TimelineScale` and `TimelineScaleCanvas`.

## Files

- `TimelineScale.js`
    - Converts raw media items into yearly density data.
    - Main functions:
        - `getValidMediaDates(items)`
        - `getYearScale(items)`
        - `TimelineScale({ items, currentDate, onDateChange })`

- `TimelineScaleCanvas.js`
    - Renders the scale using canvas.
    - Handles pointer hover, current-date pointer, dragging, snapping, and tooltip data.
    - Main functions:
        - `getTimelineLayout(yearScale, availableHeight)`
        - `getVisibleMonthlyCounts(yearData)`
        - `getMonthLayouts(segment)`
        - `getMonthLayoutAtPoint(segment, point)`
        - `getDateAtPoint(layout, point)`
        - `getPointerFromDate(layout, value)`
        - `drawTimelineScale(...)`
        - `TimelineScaleCanvas({ yearScale, currentDate, onDateChange })`

## Data shape

`TimelineScale.js` converts media items into year records shaped like:

```js
{
    year: 2024,
    mediaCount: 120,
    monthlyCount: [10, 0, 4, 20, 0, 0, 18, 30, 2, 0, 12, 24],
    percentage: 14.2,
}
```

Rules:

- `mediaCount` is total media for that year.
- `monthlyCount` always has 12 entries, January to December.
- `percentage` is the year count divided by total library media count.
- Empty years between oldest and newest media date are included with zero counts.

## Year height logic

Year height is calculated in `getTimelineLayout()`.

The rule is:

1. Reserve minimum readable height for every year.
2. Distribute only the remaining available height by yearly media density.

Formula:

```txt
minimumRequiredHeight = numberOfYears * MIN_YEAR_SEGMENT_HEIGHT
extraHeight = availableHeight - minimumRequiredHeight
yearHeight = MIN_YEAR_SEGMENT_HEIGHT + extraHeight * (yearMediaCount / totalMediaCount)
```

This means:

- Every year remains readable.
- Dense years get more vertical space.
- Sparse years do not disappear.
- If there are too many years, the canvas becomes taller and the container scrolls vertically.

## Month rendering logic

Month rendering is calculated in `getMonthLayouts(segment)`.

Important rule:

- Years compete globally for height.
- Months compete locally inside their own year.

The month logic is:

1. Remove months with `0` media using `getVisibleMonthlyCounts()`.
2. Reserve fixed gaps between visible months.
3. Let visible months split the remaining year month area by local monthly share.

Formula:

```txt
visibleMonths = monthlyCount entries where count > 0
gapHeight = (visibleMonths.length - 1) * MONTH_STICK_GAP
drawableMonthHeight = yearMonthAreaHeight - gapHeight
monthHeight = drawableMonthHeight * (monthCount / yearMediaCount)
```

This is intentional.

A dense year has already earned more height from `getTimelineLayout()`, so its months should use that year-owned space. Month heights should not be normalized against the full library again, because that double-penalizes dense years.

## Month width logic

Month width is local to the year.

In `drawTimelineScale()`, width is calculated against the largest month in the same year:

```txt
monthWidth = availableWidth * (monthCount / maxMonthCountWithinThatYear)
```

Example:

```txt
Year months: [10, 5, 24]
Widths:      [10/24, 5/24, 24/24]
```

This makes each year internally readable while year height communicates the global density.

## Pointer and snapping logic

Pointer-related behavior is implemented in `TimelineScaleCanvas.js`.

There are two visual pointer concepts:

- Hover pointer
    - Follows the mouse/pointer.
    - Shows tooltip data for the nearest rendered month.

- Current pointer
    - Derived from `currentDate`.
    - Drawn in macOS blue (`#007aff`).
    - Draggable.
    - Calls `onDateChange(date)` while dragging.

Snapping is based on rendered month bars, not raw calendar interpolation.

Important functions:

- `getMonthLayouts(segment)`
    - Produces the exact month bars drawn on canvas.

- `getMonthLayoutAtPoint(segment, point)`
    - Returns the month bar under the pointer.
    - If the pointer is in a gap, snaps to the nearest rendered month.

- `getDateAtPoint(layout, point)`
    - Converts a canvas point into a snapped month date.

- `getPointerFromDate(layout, value)`
    - Converts `currentDate` into the center of the matching rendered month bar.

This keeps the visualization and info box consistent.

## Design principles

The timeline scale follows these visual rules:

1. Year height represents global yearly density.
2. Month height represents local distribution inside that year.
3. Month width represents local comparison inside that year.
4. Months with zero media are not rendered.
5. Pointer and tooltip data snap to rendered months only.
6. The current pointer should stay visually distinct from hover state.

## Why not use global month height?

Global month normalization was rejected because it caused dense years to underuse the height they had already earned.

Bad model:

```txt
monthHeight = monthCount / totalLibraryCount
```

That double-counts global density:

- once at year height level
- again at month height level

Correct model:

```txt
yearHeight = yearCount / totalLibraryCount
monthHeight = monthCount / yearCount
```

This creates a proper hierarchy:

- global density at year level
- local distribution at month level

## Future sync behavior

`TimelineScaleCanvas` already exposes `onDateChange(date)` from drag interactions.

The intended parent-level flow is:

1. User drags current pointer.
2. `TimelineScaleCanvas` emits a snapped month date.
3. Parent timeline view stores that date.
4. Thumbnail list scrolls to the nearest media item for that date.

This sync is intentionally kept outside `TimelineScaleCanvas` so the scale remains a visual/date control, not a thumbnail-list controller.
