import React, { useEffect, useState } from 'react';
import Button from '__components/core-components/button/Button';
import Modal, { ModalActionFooter } from '__components/core-components/modal/Modal';
import formStyles from '__styles/forms.css';
import mediaTypes from '__constants/mediaTypes';
import responseStatus from '__constants/responseStatus';
import IconButton from '__components/core-components/icon-button/IconButton';

const DEFAULT_LOCATION_RADIUS = 1000;
const LOCATION_RADIUS_OPTIONS = [100, 200, 500, 1000, 2000, 3000, 5000];

const LocationEditForm = ({ locationClusterDetails = null, mediaId, mediaType, onLocationEditDone, onCancel }) => {
    const currentLocationName = locationClusterDetails?.name || '';

    const isReferencedLocation = locationClusterDetails?.referenceId !== null;
    const isUnnamedCustomLocation = !isReferencedLocation && currentLocationName === '';

    const [locationValue, setLocationValue] = useState(currentLocationName);
    const [radius, setRadius] = useState(isReferencedLocation ? DEFAULT_LOCATION_RADIUS : locationClusterDetails.radius);
    const [showCustomLocation, setShowCustomLocation] = useState(false);

    const [formName, setFormName] = useState('');

    const formNames = {
        CREATE_CUSTOM_LOCATION: 'createCustomLocation',
        EDIT_CUSTOM_LOCATION: 'editCustomLocation',
        IDENTIFY_LOCATION: 'identifLocation',
    };

    useEffect(() => {
        setRadius(DEFAULT_LOCATION_RADIUS);
        setShowCustomLocation(isUnnamedCustomLocation);
    }, [locationClusterDetails, isUnnamedCustomLocation]);

    const saveLocation = () => {
        const trimmedLocation = locationValue.trim();
        if (trimmedLocation === '') {
            return;
        }

        let updateLocationPromise;

        if (formName === formNames.CREATE_CUSTOM_LOCATION) {
            updateLocationPromise = window.api.createCustomMediaLocation(mediaType, mediaId, trimmedLocation, radius);
        } else if (formName === formNames.IDENTIFY_LOCATION) {
            updateLocationPromise = window.api.nameUnnamedMediaLocation(locationClusterDetails.id, trimmedLocation, radius);
        } else if (formName === formNames.EDIT_CUSTOM_LOCATION) {
            updateLocationPromise = window.api.updateCustomLocation(locationClusterDetails.id, trimmedLocation, radius);
        }
        updateLocationPromise.then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                onLocationEditDone && onLocationEditDone(trimmedLocation);
            } else {
                alert('Failed to update location.', response?.message);
            }
        });
    };

    const onLocationInputKeyDown = (event) => {
        if (event.key === 'Enter') {
            saveLocation();
        }
    };

    return (
        <div>
            <h2>Location</h2>

            {isReferencedLocation && currentLocationName !== '' && (
                <>
                    <div className="mt5">{currentLocationName}</div>
                    <div className="mt10">
                        <Button onClick={() => setFormName(formNames.CREATE_CUSTOM_LOCATION)}>Not the right location ?</Button>
                    </div>
                </>
            )}

            {!isReferencedLocation && currentLocationName !== '' && (
                <div className="flex mt10">
                    <div className="mt5" onDoubleClick={() => setFormName(formNames.EDIT_CUSTOM_LOCATION)}>
                        {currentLocationName}
                    </div>
                    {!showCustomLocation && <IconButton icon="edit" onClick={() => setFormName(formNames.EDIT_CUSTOM_LOCATION)} />}
                </div>
            )}

            {isReferencedLocation && currentLocationName === '' && (
                <div>
                    <div className="mt5">{'Unknown location'}</div>
                    <div className="mt10">
                        <Button onClick={() => setFormName(formNames.IDENTIFY_LOCATION)}>Give it a name</Button>
                    </div>
                </div>
            )}

            {formName != '' && (
                <>
                    <h4 className="mt15">{!isReferencedLocation ? 'Update the custom location' : 'Create a custom location'}</h4>
                    <div className={'mt15'}>
                        <input
                            type="text"
                            value={locationValue}
                            placeholder="Type the location"
                            maxLength={200}
                            spellCheck="true"
                            className={formStyles.formTextInputFullWidth}
                            required={true}
                            onChange={(e) => setLocationValue(e.target.value)}
                            onKeyDown={(e) => onLocationInputKeyDown(e)}
                        />
                    </div>
                    <div className={'mt15'}>
                        <label htmlFor={`location-radius-${mediaType}-${mediaId}`}>How big is the place?</label>
                        <div className={'mt10'}>
                            <select
                                id={`location-radius-${mediaType}-${mediaId}`}
                                value={radius}
                                className={formStyles.formSelect}
                                onChange={(e) => setRadius(Number(e.target.value))}
                            >
                                {LOCATION_RADIUS_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option} m
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="mt10 secondaryInfo">
                            ** All media within this radius will be autometically get tagged to this location.
                        </div>
                    </div>
                </>
            )}
            {isUnnamedCustomLocation && (
                <div>
                    <h3>Give it a name</h3>
                    <div className={'mt15'}>
                        <input
                            type="text"
                            value={locationValue}
                            placeholder="Type the location"
                            maxLength={200}
                            spellCheck="true"
                            className={formStyles.formTextInputFullWidth}
                            required={true}
                            onChange={(e) => setLocationValue(e.target.value)}
                            onKeyDown={(e) => onLocationInputKeyDown(e)}
                        />
                    </div>
                    <div className={'mt15'}>
                        <label htmlFor={`location-radius-${mediaType}-${mediaId}`}>How big is the place?</label>
                        <div className={'mt10'}>
                            <select
                                id={`location-radius-${mediaType}-${mediaId}`}
                                value={radius}
                                className={formStyles.formSelect}
                                onChange={(e) => setRadius(Number(e.target.value))}
                            >
                                {LOCATION_RADIUS_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option} m
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}
            <ModalActionFooter>
                <Button onClick={onCancel}>Close</Button>
                <span className={'ml10'}>
                    {locationValue.trim() !== '' && formName !== '' && (
                        <Button type="primaryBtn" onClick={saveLocation}>
                            Save
                        </Button>
                    )}
                </span>
            </ModalActionFooter>
        </div>
    );
};

const EditableLocation = ({ mediaId, mediaType = mediaTypes.IMAGE, locationName = '', onEditComplete }) => {
    const [locationLabel, setLocationLabel] = useState(locationName || 'Unknown location');
    const [isLocationEditorOpen, setIsLocationEditorOpen] = useState(false);
    const [locationClusterDetails, setLocationClusterDetails] = useState(null);

    useEffect(() => {
        setLocationLabel(locationName || 'Unknown location');
    }, [locationName, mediaId, mediaType]);

    const openLocationEditor = () => {
        window.api.getLocationDetailsByMedia(mediaType, mediaId).then((response) => {
            if (response && response.status === responseStatus.SUCCESS) {
                setLocationClusterDetails(response.data);
            } else {
                setLocationClusterDetails(null);
            }
            setIsLocationEditorOpen(true);
        });
    };

    return (
        <>
            <div className="textRight" onClick={openLocationEditor}>
                {locationLabel}
            </div>

            {isLocationEditorOpen && (
                <Modal isOpen={isLocationEditorOpen} onClose={() => setIsLocationEditorOpen(false)} modifierClasses={'regModal'}>
                    <LocationEditForm
                        locationClusterDetails={locationClusterDetails}
                        mediaId={mediaId}
                        mediaType={mediaType}
                        onLocationEditDone={(updatedLocation) => {
                            setLocationLabel(updatedLocation);
                            onEditComplete && onEditComplete();
                            setIsLocationEditorOpen(false);
                        }}
                        onCancel={() => setIsLocationEditorOpen(false)}
                    />
                </Modal>
            )}
        </>
    );
};

export default EditableLocation;
