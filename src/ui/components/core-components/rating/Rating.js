// react rating component that make use of html utf characters for star rating
import React, { useState, useEffect } from 'react';

import keyCodes from '__constants/keyCodes';
import responseStatus from '__constants/responseStatus';

const Rating = ({ rating = 0, videoId = null }) => {
    const [selectedRating, setSelectedRating] = useState(rating);

    useEffect(() => {
        if (videoId != null) {
            setSelectedRating(rating);
        } else {
            setSelectedRating(0); // reset rating when videoId is null
        }
    }, [videoId, rating]);

    const onRatingChange = (rating) => {
        setSelectedRating(rating);
        // update the rating in the database
        window.api.updateContentRating(videoId, rating).then((response) => {
            if (response.status === responseStatus.SUCCESS) {
                // no need to show anything.
            } else {
                alert('There is some problem in updating rating data.');
            }
        });
    };

    const stars = Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={`star ${index < selectedRating ? 'selected' : ''}`} onClick={() => onRatingChange(index + 1)}>
            {index < selectedRating ? '★' : '☆'}
        </span>
    ));

    const onKeyDown = (event) => {
        if (event.key === keyCodes.ARROW_DOWN || event.key === keyCodes.ARROW_LEFT) {
            setSelectedRating(selectedRating - 1 > 0 ? selectedRating - 1 : 0);
        }
        if (event.key === keyCodes.ARROW_UP || event.key === keyCodes.ARROW_RIGHT) {
            setSelectedRating(selectedRating + 1 < 5 ? selectedRating + 1 : 5);
        }
        if (event.key === keyCodes.SPACE || event.key === keyCodes.ENTER) {
            onRatingChange(selectedRating);
        }
    };

    return (
        <div className="rating" tabIndex={0} onKeyDown={onKeyDown}>
            {stars}
        </div>
    );
};

export default Rating;
