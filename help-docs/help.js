function gotoSection(sectionId) {
    document.getElementById(sectionId).scrollIntoView();
}
// Listen for a message from the main process
window.helpApi.on('helpGotoSection', (event, sectionId) => {
    const paths = sectionId.split('___');

    loadContent(paths[0]);
    setTimeout(() => {
        if (paths[1]) gotoSection(paths[1]);
    }, 200);
});

const contentMap = {
    'getting-started': 'getting-started.html',
    'organizing-your-media': 'organize-your-media.html',
    'ai-features': 'ai-features.html',
    searching: 'search.html',
    tips: 'tip-shortcuts.html',
    'support-about': 'about.html',
    license: 'license.html',
};
// load section from help-docs folder and replace content within #main
const mainContainer = document.getElementById('main');
const loadContent = (link) => {
    link = `help-docs/${contentMap[link]}`;

    fetch(link)
        .then((response) => response.text())
        .then((data) => {
            mainContainer.innerHTML = data;
        })
        .catch((error) => console.error('Error:', error));
};

const topicsList = document.querySelectorAll('#topics li a[href]');

topicsList.forEach((topic) => {
    topic.addEventListener('click', (event) => {
        event.preventDefault();
        const sectionId = topic.getAttribute('href').slice(1);
        loadContent(sectionId);
    });
});

topicsList[0].click(); // load the first section on page load
