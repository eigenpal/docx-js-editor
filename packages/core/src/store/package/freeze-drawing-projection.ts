import type { DrawingProjection } from './drawing-projection.ts';

export function freezeDrawingProjection(projection: DrawingProjection): DrawingProjection {
  return Object.freeze({
    ...projection,
    extentEmu: Object.freeze({ ...projection.extentEmu }),
    effectExtentEmu: Object.freeze({ ...projection.effectExtentEmu }),
    inlineDistancesEmu: Object.freeze({ ...projection.inlineDistancesEmu }),
    wrapGeometry: projection.wrapGeometry
      ? Object.freeze({
          ...projection.wrapGeometry,
          distancesEmu: Object.freeze({ ...projection.wrapGeometry.distancesEmu }),
          polygon: Object.freeze(
            projection.wrapGeometry.polygon.map((point) => Object.freeze({ ...point }))
          ),
        })
      : null,
    position: projection.position
      ? Object.freeze({
          ...projection.position,
          simplePosition: Object.freeze({ ...projection.position.simplePosition }),
          horizontal: Object.freeze({ ...projection.position.horizontal }),
          vertical: Object.freeze({ ...projection.position.vertical }),
        })
      : null,
    anchor: projection.anchor ? Object.freeze({ ...projection.anchor }) : null,
    picture: projection.picture
      ? Object.freeze({
          ...projection.picture,
          crop: Object.freeze({ ...projection.picture.crop }),
          transform: Object.freeze({ ...projection.picture.transform }),
        })
      : null,
    vectorShape: projection.vectorShape
      ? Object.freeze({
          ...projection.vectorShape,
          extentEmu: Object.freeze({ ...projection.vectorShape.extentEmu }),
          subpathsEmu: Object.freeze(
            projection.vectorShape.subpathsEmu.map((points) =>
              Object.freeze(points.map((point) => Object.freeze({ ...point })))
            )
          ),
          // `components` is required and non-empty: paint iterates it, so a conditional
          // spread that ever took the empty branch would strip the field and throw.
          components: Object.freeze(
            projection.vectorShape.components.map((component) =>
              Object.freeze({
                ...component,
                subpathsEmu: Object.freeze(
                  component.subpathsEmu.map((points) =>
                    Object.freeze(points.map((point) => Object.freeze({ ...point })))
                  )
                ),
              })
            )
          ),
        })
      : null,
    // `content` is a canonical-tree node shared with the store; it is not deep-frozen here.
    textboxStory: projection.textboxStory
      ? Object.freeze({
          ...projection.textboxStory,
          insetsEmu: Object.freeze({ ...projection.textboxStory.insetsEmu }),
        })
      : null,
    locks: Object.freeze({ ...projection.locks }),
    effects: Object.freeze({ ...projection.effects }),
    diagnostics: Object.freeze(
      projection.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))
    ),
  });
}
