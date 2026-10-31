import React from 'react';
import style from './SubjectFace.css';

const SubjectFace = ({ face, title, alt, className = '', children, faceCount = 0 }) => {
    if (!face?.imagePath) {
        return null;
    }

    const imageTitle = title || `${face.id || face.imagePath}${face.confidence ? ` - ${face.confidence}` : ''}`;
    const imageAlt = alt || face.id || face.imagePath;

    return (
        <div className={`${style.subjectFaceWrapper} ${className}`}>
            <img src={face.imagePath} alt={imageAlt} title={imageTitle} loading="lazy" className={style.subjectFaceImage} />
            {faceCount > 1 && <div className={style.faceCountBadge}>{faceCount}</div>}
            {children}
        </div>
    );
};

export default SubjectFace;
