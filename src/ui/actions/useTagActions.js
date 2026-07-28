// this is an action hook, that will control all the event actions of modifying the actions

import { useEffect, useState } from 'react';

import { useApplicationContext } from '__contexts/app.context';
import mainThreadEvents from '__events/mainThreadEvents';
import responseStatus from '__constants/responseStatus';

const useTagActions = () => {
    const [stateContext, dispatchContext] = useApplicationContext();
    const [tags, setTags] = useState([]);

    /**
     * Add tag is fired to add a new item to the tag
     * @param {*} tag
     */
    const addTag = (tag) => {
        window.api.addNewTag(tag).then((response) => {
            if (response?.status === responseStatus.SUCCESS) {
                dispatchContext({ type: mainThreadEvents.ON_TAGS_UPDATE, payload: { tags: response.data } });
            } else {
                alert('Failed to add tag', response.message);
            }
        });
    };

    /**
     * Remove tag is fired to remove an item from the tag
     * @param {*} tagId
     */
    const removeTag = (tagId) => {
        window.confirm('Are you sure you want to remove this tag?') &&
            window.api.removeTag(tagId).then((response) => {
                if (response?.status === responseStatus.SUCCESS) {
                    dispatchContext({ type: mainThreadEvents.ON_TAGS_UPDATE, payload: { tags: response.data } });
                } else {
                    alert('Failed to remove tag', response.message);
                }
            });
    };

    /**
     * Rename tag is fired to rename an item in the tag
     * @param {*} tagId
     * @param {*} newName
     */
    const renameTag = (tagId, newName) => {
        window.api.renameTag(tagId, newName).then((response) => {
            if (response?.status === responseStatus.SUCCESS) {
                dispatchContext({ type: mainThreadEvents.ON_TAGS_UPDATE, payload: { tags: response.data } });
            } else {
                alert('Failed to rename tag', response.message);
            }
        });
    };

    useEffect(() => {
        setTags(stateContext.tags);
    }, [stateContext.tags]);

    return {
        addTag,
        removeTag,
        renameTag,
        tags,
    };
};

export default useTagActions;
