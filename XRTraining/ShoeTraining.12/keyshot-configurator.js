document.addEventListener("DOMContentLoaded", function() {
    augmentmodel();
    adddynamicstyling();
    setup();
});

window.addEventListener("load", function() {
    calculatefitzoomfactor();
    let zoomfactor = Math.min(fittoviewzoomfactor, 1);
    setzoomfactor(zoomfactor, true);
});

window.addEventListener("resize", function() {
    calculatefitzoomfactor();
    if (document.getElementById('toolbar-fittoview').classList.contains('selected')) {
        setzoomfactor(fittoviewzoomfactor, true);
    } else {
        alignimage();
        let mainelm = document.getElementById('main');
        let zoomfactor = mainelm.style.getPropertyValue('--image-zoom-factor');
        zoomfactor = Number(zoomfactor);
        mainelm.firstElementChild.classList.toggle('movablecursor', zoomfactor > fittoviewzoomfactor);
    }
});

iconaspectratiocache = {};
imagemoving = false;

function adddynamicstyling() {
    let rootstyle = document.querySelector(':root').style;
    rootstyle.setProperty('--color-panel-background', layoutsettings.colorPanelBackground);
    rootstyle.setProperty('--color-panel-border', layoutsettings.colorPanelBorder);
    rootstyle.setProperty('--color-title-text', layoutsettings.colorTitleText);
    rootstyle.setProperty('--color-title-background', layoutsettings.colorTitleBackground);
    rootstyle.setProperty('--color-title-text-selected', layoutsettings.colorTitleTextSelected);
    rootstyle.setProperty('--color-title-background-selected', layoutsettings.colorTitleBackgroundSelected);
    rootstyle.setProperty('--color-title-text-hover', layoutsettings.colorTitleTextHover);
    rootstyle.setProperty('--color-title-background-hover', layoutsettings.colorTitleBackgroundHover);
    rootstyle.setProperty('--color-thumbnail-text', layoutsettings.colorThumbnailText);
    rootstyle.setProperty('--color-thumbnail-background', layoutsettings.colorThumbnailBackground);
    rootstyle.setProperty('--color-thumbnail-border', layoutsettings.colorThumbnailBorder);
    rootstyle.setProperty('--color-thumbnail-text-selected', layoutsettings.colorThumbnailTextSelected);
    rootstyle.setProperty('--color-thumbnail-background-selected', layoutsettings.colorThumbnailBackgroundSelected);
    rootstyle.setProperty('--color-thumbnail-border-selected', layoutsettings.colorThumbnailBorderSelected);
    rootstyle.setProperty('--color-thumbnail-text-hover', layoutsettings.colorThumbnailTextHover);
    rootstyle.setProperty('--color-thumbnail-background-hover', layoutsettings.colorThumbnailBackgroundHover);
    rootstyle.setProperty('--color-thumbnail-border-hover', layoutsettings.colorThumbnailBorderHover);
    rootstyle.setProperty('--color-window-background', layoutsettings.colorWindowBackground);
    rootstyle.setProperty('--size-titles-font', layoutsettings.sizeTitlesFont);
    rootstyle.setProperty('--size-thumbnail-font', layoutsettings.sizeThumbnailFont);
    rootstyle.setProperty('--touch-ui-height', layoutsettings.touchUIHeight);
}

class FlowBase {
    static init(templateid, classproto) {
        let templateelement = document.getElementById(templateid);
        templateelement.remove();
        templateelement = templateelement.content.firstElementChild;
        classproto.flowelementtemplate = templateelement;
        let bodyitemelements = templateelement.querySelectorAll('.flowthumbnailitem');
        bodyitemelements.forEach(e => e.remove());
        classproto.bodyitemtemplates = bodyitemelements;
        if (!FlowBase.allwidgets) {
            FlowBase.allwidgets = [];
        }

        let draghandleelement = document.getElementById('flowwidgetdraghandle');
        if (draghandleelement) {
            draghandleelement.remove();
            draghandleelement = draghandleelement.content.firstElementChild;
            FlowBase.prototype.draghandleelement = draghandleelement;
            draghandleelement.addEventListener('mousedown', starthandledrag);
        }
    }

    constructor(actionfunc) {
        this.actionfunc = actionfunc;
        this.flowelement = this.flowelementtemplate.cloneNode(true);

        let panelarea = document.querySelector('.panelarea');
        if (panelarea.childElementCount > 0)
            panelarea.appendChild(this.draghandleelement);
        panelarea.appendChild(this.flowelement);
        this.selectedactionindex = 0;
        FlowBase.allwidgets.push(this);
        window.addEventListener('resize', this.configurethumbnailsize.bind(this));
    }

    updateactiongroup(actiongroupelement, actionelementtemplate, clickhandler) {
        while (actiongroupelement.firstElementChild)
            actiongroupelement.firstElementChild.remove();
        this.currentactions = this.actionfunc().filter(group => group.childitems.length >= 2);
        let index = 0;
        for (let action of this.currentactions) {
            let actionelement = actionelementtemplate.cloneNode(true);
            let titleelement = actionelement;
            if (!titleelement.classList.contains('flowheadertextbox'))
                titleelement = titleelement.querySelector('.flowheadertextbox');
            titleelement.style.setProperty('--headertext-title', cssstringify(action.name));
            titleelement.style.setProperty('--headertext-value', cssstringify(action.selecteditem.name));
            if (index == this.selectedactionindex)
                this.makeselected(actionelement);
            titleelement.addEventListener('click', clickhandler.bind(this, index, actionelement));
            actiongroupelement.appendChild(actionelement);
            index++;
        }
        showselectedimage();
    }

    createbody(bodyelement) {
        let currentaction = this.currentactions[this.selectedactionindex];
        bodyelement.style.setProperty('--thumbnail-size-percentage', currentaction.iconrelativesize + '%');
        for (let item of currentaction.childitems) {
            let hasicon = Boolean(item.icon);
            let bodyitemelement = this.bodyitemtemplates[!hasicon+0].cloneNode(true);
            let thumbnailitemelement = bodyitemelement.firstElementChild;
            let imageelement;
            if (hasicon) {
                imageelement = thumbnailitemelement.getElementsByTagName('img')[0];
                imageelement.src = item.icon;
                if (!(imageelement.src in iconaspectratiocache)) {
                    imageelement.addEventListener('load', () => {
                        iconaspectratiocache[imageelement.src] = imageelement.naturalWidth / imageelement.naturalHeight;
                    });
                }
            }
            thumbnailitemelement.getElementsByTagName('span')[0].firstChild.data = item.name;
            if (item == item.parentitem.selecteditem)
                thumbnailitemelement.classList.add('selected');
            thumbnailitemelement.addEventListener('click', this.bodyselecthandler.bind(this, item));
            bodyelement.appendChild(bodyitemelement);
        }
        this.configurethumbnailsize();
    }

    bodyselecthandler(item, event) {
        item.parentitem.selecteditem = item;
        let body = this.currentbodyelement;
        let left = body.scrollLeft;
        let top = body.scrollTop;
        this.updateactiondisplay();
        this.currentbodyelement.scrollLeft = left;
        this.currentbodyelement.scrollTop = top;
    }

    makeselected(groupelement) {
        if (this.selectedgroupelement)
            this.selectedgroupelement.classList.remove('selected');
        groupelement.classList.add('selected');
        this.selectedgroupelement = groupelement;
    }

    configurethumbnailsize() {
        let imageelement = this.currentbodyelement.querySelector('.flowthumbnailitem img');
        if (!imageelement)
            return;
        let ratio = iconaspectratiocache[imageelement.src];
        if (ratio) {
            this.configurethumbnailsizeimpl(imageelement, ratio);
        } else {
            imageelement.addEventListener('load', this.configurethumbnailsize.bind(this));
        }
    }

    configurethumbnailsizeimpl(imageelement, ratio) {}

    static resetall() {
        FlowBase.allwidgets.forEach(function(w) {
            w.selectedactionindex = 0;
            w.updateactiondisplay();
        });
    }
}

class FlowSelection extends FlowBase {
    static init() {
        super.init('flowselectiontemplate', FlowSelection.prototype);
        let menuitemelement = FlowSelection.prototype.flowelementtemplate.querySelector('.flowselectionheadermenu').firstElementChild;
        menuitemelement.remove();
        FlowSelection.prototype.menuitemtemplate = menuitemelement;
        let headerboxelement = FlowSelection.prototype.flowelementtemplate.querySelector('.flowselectionheaderbox');
        cleannode(headerboxelement);
    }

    constructor(actionfunc) {
        super(actionfunc);
        this.currentbodyelement = this.flowelement.querySelector('.flowselectionbody');
        this.testflexboxwrapworkaround();
        let menuscrollers = this.flowelement.querySelectorAll('.flowselectionheaderscroller');
        menuscrollers[0].addEventListener('click', this.menuscrollerhandler.bind(this, -1));
        menuscrollers[1].addEventListener('click', this.menuscrollerhandler.bind(this, 1));
        this.menuindexelement = menuscrollers[0].nextElementSibling;
        this.menuindexelement.addEventListener('click', this.showmenuhandler.bind(this));

        this.selectiondisplayelement = this.flowelement.querySelector('.flowselectionheadermenu + .flowheadertextbox');
        this.selectiondisplayelement.addEventListener('click', this.showmenuhandler.bind(this));

        this.updateactiondisplay();
        let menuscrollerparent = menuscrollers[0].parentNode;
        menuscrollerparent.classList.toggle('hidden', this.currentactions.length < 2);
    }

    testflexboxwrapworkaround() {
        let tmpelm = document.createElement('div');
        this.currentbodyelement.appendChild(tmpelm);
        if (tmpelm.clientWidth == this.currentbodyelement.clientWidth) {
            // It looks like the browser ignores the "align-content" property when the flexbox content
            // is not wrapped. (That most likely means Safari, for recent browser versions)
            // Add an invisible pseudoelement to force the columns to wrap.
            document.querySelector('.panelarea').classList.add('flexaligncontentworkaround');
        }
        tmpelm.remove();
    }

    updateactiondisplay() {
        let menuelement = this.flowelement.querySelector('.flowselectionheadermenu');
        this.updateactiongroup(menuelement, this.menuitemtemplate, this.selectindex);
        menuelement.classList.toggle('multioptions', this.currentactions.length > 1);
        this.updatebody();
    }

    updatebody() {
        let bodyelement = this.currentbodyelement;
        while (bodyelement.firstElementChild) {
            bodyelement.firstElementChild.remove();
        }
        this.createbody(bodyelement);
        this.selectiondisplayelement.style.setProperty('--headertext-title', this.selectedgroupelement.style.getPropertyValue('--headertext-title'));
        this.selectiondisplayelement.style.setProperty('--headertext-value', this.selectedgroupelement.style.getPropertyValue('--headertext-value'));
        this.menuindexelement.firstChild.data = `${this.selectedactionindex+1}/${this.currentactions.length}`;
    }

    configurethumbnailsizeimpl(imageelement, ratio) {
        let bodyelement = this.currentbodyelement;
        bodyelement.classList.remove('listlayout');
        let scrollbar1 = (bodyelement.clientWidth < bodyelement.scrollWidth);
        bodyelement.style.setProperty('--current-thumbnail-width', (imageelement.clientHeight * ratio) + 'px');
        let scrollbar2 = (bodyelement.clientWidth < bodyelement.scrollWidth);
        if (scrollbar2 != scrollbar1) {
            bodyelement.style.setProperty('--current-thumbnail-width', (imageelement.clientHeight * ratio) + 'px');
            let scrollbar3 = (bodyelement.clientWidth < bodyelement.scrollWidth);
            if (scrollbar3 != scrollbar2 && scrollbar3) {
                bodyelement.style.setProperty('--current-thumbnail-width', (imageelement.clientHeight * ratio) + 'px');
            }
        }
        this.testListLayout(imageelement);
    }

    testListLayout(imageelement) {
        let bodyelement = this.currentbodyelement;
        let textheight = imageelement.nextElementSibling.clientHeight;
        if (imageelement.clientHeight < 1.3 * textheight) {
            bodyelement.classList.add('listlayout');
        }
    }

    menuscrollerhandler(delta) {
        let newindex = this.selectedactionindex + delta;
        if (newindex < 0 || newindex >= this.currentactions.length)
            return;
        let elm = this.selectedgroupelement;
        this.selectindex(newindex, delta > 0 ? elm.nextElementSibling : elm.previousElementSibling);
    }

    showmenuhandler(event) {
        if (this.currentactions.length < 2)
            return;
        if (globalvisiblemenu)
            return;
        let menuelement = this.flowelement.querySelector('.flowselectionheadermenu');
        menuelement.classList.remove('hidden');
        globalvisiblemenu = menuelement;
        event.stopPropagation();
    }

    selectindex(newindex, groupelement) {
        this.selectedactionindex = newindex;
        this.makeselected(groupelement);
        this.updatebody();
    }
}

class FlowAccordion extends FlowBase {
    static init() {
        super.init('flowaccordiontemplate', FlowAccordion.prototype);
        let groupelement = FlowAccordion.prototype.flowelementtemplate.querySelector('.flowaccordiongroup');
        groupelement.remove();
        FlowAccordion.prototype.groupelement = groupelement;
    }

    constructor(actionfunc) {
        super(actionfunc);
        this.updateactiondisplay();
    }

    get currentbodyelement() {
        return this.selectedgroupelement.lastElementChild;
    }

    updateactiondisplay() {
        this.updateactiongroup(this.flowelement, this.groupelement, this.groupselecthandler);
        this.createbody(this.selectedgroupelement.lastElementChild);
    }

    configurethumbnailsizeimpl(imageelement, ratio) {
        let bodyelement = this.currentbodyelement;
        bodyelement.style.setProperty('--current-thumbnail-height', (imageelement.clientWidth / ratio) + 'px');
    }

    groupselecthandler(index, groupelement, event) {
        let bodyelement = groupelement.lastElementChild;
        this.selectedactionindex = index;
        if (!bodyelement.firstElementChild)
            this.createbody(bodyelement);
        this.makeselected(event.currentTarget.parentNode);
    }
}

function setup() {
    generateimagedatamappings();
    FlowSelection.init();
    FlowAccordion.init();

    if (layoutsettings.ibooksWidget) {
        document.body.style.width = window.innerWidth + "px";
        document.body.style.height = window.innerHeight + "px";

        let savecfgbutton = document.getElementById('toolbar-savecfg');
        savecfgbutton.classList.add('nodisplay');
    }

    let panelarea = document.querySelector('.panelarea');
    if (!layoutsettings.includeThumbnailText) {
        panelarea.classList.add('hidethumbnailtext');
    }

    function studioactions() {
        return [
            studiogroup,
        ];
    }

    let flowwidgettype;
    if (layoutsettings.menuLayout == 'horizontal') {
        globalvisiblemenu = null;
        document.addEventListener('click', function() { if (globalvisiblemenu) { globalvisiblemenu.classList.add('hidden'); globalvisiblemenu = null; } });
        flowwidgettype = FlowSelection;
    } else {
        flowwidgettype = FlowAccordion;
    }
    let hidepanelarea = true;
    let actions = flowactions().filter(group => group.childitems.length >= 2);
    if (actions.length > 0) {
        new flowwidgettype(flowactions);
        hidepanelarea = false;
    }
    if (model.studios && model.studios.length > 1) {
        new flowwidgettype(studioactions);
        hidepanelarea = false;
    }
    if (hidepanelarea) {
        panelarea.classList.add('hidden');
        showselectedimage();
    }

    if (layoutsettings.menuLayout == 'vertical') {
        panelarea.classList.remove('layouthorizontal');
        panelarea.classList.add('layoutvertical');
    }

    let button = document.getElementById('toolbar-reset');
    button.addEventListener('click', resetconfiguration);
    button = document.getElementById('toolbar-savecfg');
    button.addEventListener('click', saveconfiguration);
    button = document.getElementById('toolbar-zoomin');
    button.addEventListener('click', zoom.bind(null, 1.2));
    button = document.getElementById('toolbar-zoomout');
    button.addEventListener('click', zoom.bind(null, 1 / 1.2));
    button = document.getElementById('toolbar-fittoview');
    button.addEventListener('click', fittoview);
    button = document.getElementById('toolbar-actualsize');
    button.addEventListener('click', actualsize);

    let imgelm = document.querySelector('.mainimg');
    imgelm.addEventListener('mousedown', imagemousedown);
    imgelm.addEventListener('mousemove', imagemousemove);
    imgelm.addEventListener('mouseup', imagemouseup);
    imgelm.addEventListener('mouseleave', imagemouseleave);
    if (window.location.protocol == 'file:' && window.navigator.platform == 'Win32')
        imgelm.addEventListener('error', windowspatherrorcheck);
}

function mapimagedata(modelsets, multimaterials, studioid) {
    let idstrings = {};
    modelsets.forEach(e => { idstrings['ms'+e] = 1; });
    multimaterials.forEach(e => { idstrings['mm'+e] = 1; });
    if (studioid != undefined) {
        idstrings['st'+studioid] = 1;
    }
    let idarray = Object.keys(idstrings);
    idarray.sort();
    return idarray.join(';');
}

function generateimagedatamappings() {
    imagemappings = {};
    imagemappingdata.forEach(
        function(obj) {
            let idstr = mapimagedata(obj.modelsets || [], obj.multimaterials || [], obj.studio);
            imagemappings[idstr] = obj.image;
        }
    );
}

function flowactions() {
    let modelactions = [];
    let materialactions = [];
    let knowngroups = {};

    function addactions(group) {
        let selecteditem = group.selecteditem;
        if (!selecteditem)
            return;
        modelactions.push(group);
        for (let materialgroup of selecteditem.materialgroups) {
            if (materialgroup.name in knowngroups)
                continue;
            materialactions.push(materialgroup);
            knowngroups[materialgroup.name] = 1;
        }
        for (let subgroup of selecteditem.productoptiongroups || []) {
            addactions(subgroup);
        }
    }
    addactions(model);

    return modelactions.concat(materialactions);
}

function showselectedimage() {
    let actions = flowactions();
    let modelsets = [];
    let multimaterials = [];
    for (let action of actions) {
        let item = action.selecteditem;
        if ('modelset' in item)
            modelsets.push(item.modelset);
        if ('multimaterials' in item)
            multimaterials = multimaterials.concat(item.multimaterials);
    }
    let studioid;
    if (studiogroup.selecteditem)
        studioid = studiogroup.selecteditem.id;

    let idstr = mapimagedata(modelsets, multimaterials, studioid);
    let imagename = imagemappings[idstr] || 'missing_image.png';
    let imgelm = document.querySelector('.mainimg');
    imgelm.src = 'images/' + encodeURIComponent(imagename);
}

function initcheckeditem(group) {
    group.selecteditem = undefined;
    for (let item of group.childitems) {
        if (item.checked)
            group.selecteditem = item;
        for (let subgroup of item.productoptiongroups || [])
            initcheckeditem(subgroup);
    }
    if (!group.selecteditem && group.childitems.length > 0)
        group.selecteditem = group.childitems[0];
}

function augmentmodel() {
    let materialgroupsmap = {};
    function augmentgroup(group, childarrayname, iconrelsizename) {
        group.childitems = group[childarrayname] || [];
        group.iconrelativesize = layoutsettings[iconrelsizename];
        for (let item of group.childitems) {
            item.parentitem = group;
            if ('icon' in item) {
                item.icon = 'icons/' + encodeURIComponent(item.icon);
            }
            item.materialgroups = (item.materialgroups || []).map(groupname => materialgroupsmap[groupname]);
            for (let subgroup of item.productoptiongroups || [])
                augmentgroup(subgroup, 'productoptions', iconrelsizename);
        }
    }
    model.materialgroups.forEach(function(group) {
        materialgroupsmap[group.name] = group;
        augmentgroup(group, 'materials', 'materialIconRelativeSize');
        initcheckeditem(group);
    });
    augmentgroup(model, 'products', 'modelIconRelativeSize');
    initcheckeditem(model);
    studiogroup = {
        studios: model.studios,
        name: layoutsettings.studioTabName,
    };
    augmentgroup(studiogroup, 'studios', 'studioIconRelativeSize');
    initcheckeditem(studiogroup);
    model.name = layoutsettings.parentTabName;
}

function resetconfiguration() {
    model.materialgroups.forEach(initcheckeditem);
    initcheckeditem(model);
    initcheckeditem(studiogroup);
    FlowBase.resetall();
}

function saveconfiguration() {
    let imgelm = document.querySelector('.mainimg');
    let content = 'Image URL:\n' + imgelm.src + '\n\n';
    let actions = flowactions();
    function addtype(actions, triggername, caption) {
        let str = '';
        actions.forEach(action => {
            if (triggername in action.selecteditem)
                str += '    ' + action.selecteditem.name + '\n';
        });
        if (str.length > 0) {
            content += caption;
            content += ':\n';
            content += str;
        }
    }
    addtype(actions, 'modelset', 'Modelsets');
    addtype(actions, 'multimaterials', 'Materials');
    if (studiogroup.selecteditem)
        addtype([studiogroup], 'name', 'Studio');
    alert(content);
}

function calculatefitzoomfactor() {
    let mainelm = document.getElementById('main');
    let imgelm = mainelm.firstElementChild;
    let xscale = mainelm.clientWidth / imgelm.naturalWidth;
    let yscale = mainelm.clientHeight / imgelm.naturalHeight;
    fittoviewzoomfactor = Math.min(xscale, yscale);
}

function adjustimageoffset(dx, dy) {
    let mainelm = document.getElementById('main');
    if (dx != 0) {
        let left = mainelm.style.getPropertyValue('--image-left');
        mainelm.style.setProperty('--image-left', Number(left) + dx);
    }
    if (dy != 0) {
        let top = mainelm.style.getPropertyValue('--image-top');
        mainelm.style.setProperty('--image-top', Number(top) + dy);
    }
}

function alignimage() {
    let mainelm = document.getElementById('main');
    let imgelm = mainelm.firstElementChild;
    let bb = imgelm.getBoundingClientRect();
    let parentbb = mainelm.getBoundingClientRect();
    let dx = 0, dy = 0;
    if (bb.width <= parentbb.width) {
        mainelm.style.setProperty('--image-left', 0);
    } else if (bb.left > parentbb.left) {
        dx = parentbb.left - bb.left;
    } else if (bb.right < parentbb.right) {
        dx = parentbb.right - bb.right;
    }
    if (bb.height <= parentbb.height) {
        mainelm.style.setProperty('--image-top', 0);
    } else if (bb.top > parentbb.top) {
        dy = parentbb.top - bb.top;
    } else if (bb.bottom < parentbb.bottom) {
        dy = parentbb.bottom - bb.bottom;
    }
    adjustimageoffset(dx, dy);
}

function setzoomfactor(zoomfactor, resetoffset) {
    let eq = (a, b) => Math.abs(a - b) <= 0.0001;
    let mainelm = document.getElementById('main');
    if (resetoffset) {
        mainelm.style.setProperty('--image-left', 0);
        mainelm.style.setProperty('--image-top', 0);
    }
    mainelm.style.setProperty('--image-zoom-factor', zoomfactor);
    document.getElementById('toolbar-actualsize').classList.toggle('selected', eq(zoomfactor, 1));
    document.getElementById('toolbar-fittoview').classList.toggle('selected', eq(zoomfactor, fittoviewzoomfactor));
    mainelm.firstElementChild.classList.toggle('movablecursor', zoomfactor > fittoviewzoomfactor);
}

function zoom(factor) {
    let mainelm = document.getElementById('main');
    let zoomfactor = mainelm.style.getPropertyValue('--image-zoom-factor');
    zoomfactor *= factor;
    setzoomfactor(zoomfactor, false);
    alignimage();
}

function fittoview() {
    setzoomfactor(fittoviewzoomfactor, true);
}

function actualsize() {
    setzoomfactor(1, true);
}

function imagemousedown(e) {
    if (e.button == 0) {
        imagemoving = true;
        // This is for Firefox, to prevent it initiating a drag operation:
        e.preventDefault();
    }
}

function imagemousemove(e) {
    if (imagemoving) {
        let mainelm = document.getElementById('main');
        let imgelm = mainelm.firstElementChild;
        let bb = imgelm.getBoundingClientRect();
        let parentbb = mainelm.getBoundingClientRect();
        let dx = 0, dy = 0;
        if (e.movementX > 0 && bb.left < parentbb.left) {
            dx = Math.min(e.movementX, parentbb.left - bb.left);
        } else if (e.movementX < 0 && bb.right > parentbb.right) {
            dx = Math.max(e.movementX, parentbb.right - bb.right);
        }
        if (e.movementY > 0 && bb.top < parentbb.top) {
            dy = Math.min(e.movementY, parentbb.top - bb.top);
        } else if (e.movementY < 0 && bb.bottom > parentbb.bottom) {
            dy = Math.max(e.movementY, parentbb.bottom - bb.bottom);
        }
        adjustimageoffset(dx, dy);
    }
}

function imagemouseup(e) {
    imagemoving = false;
}

function imagemouseleave(e) {
    imagemoving = false;
}

function starthandledrag(e) {
    if (e.button == 0) {
        let panelarea = document.querySelector('.panelarea');
        panelarea.addEventListener('mousemove', draghandle);
        panelarea.addEventListener('mouseup', endhandledrag);
        panelarea.addEventListener('mouseleave', endhandledrag);
        e.preventDefault();
    }
}

function draghandle(e) {
    e.preventDefault();
    let panelarea = document.querySelector('.panelarea');
    let n;
    if (panelarea.classList.contains('layouthorizontal'))
        n = (e.clientX - panelarea.clientLeft) / panelarea.clientWidth;
    else
        n = (e.clientY - panelarea.clientTop) / panelarea.clientHeight;
    n = Math.floor(100 * n);
    panelarea.style.setProperty('--flowwidget-first-size', n);
    panelarea.style.setProperty('--flowwidget-second-size', 100 - n);
    FlowBase.allwidgets.forEach(w => w.configurethumbnailsize());
}

function endhandledrag(e) {
    let panelarea = document.querySelector('.panelarea');
    panelarea.removeEventListener('mousemove', draghandle);
    panelarea.removeEventListener('mouseup', endhandledrag);
    panelarea.removeEventListener('mouseleave', endhandledrag);
}

function cleannode(node) {
    if (node.nodeType == Node.COMMENT_NODE || (node.nodeType == Node.TEXT_NODE && !/\S/.test(node.nodeValue))) {
        node.remove();
        return;
    }
    let child = node.firstChild;
    while (child) {
        let next = child.nextSibling;
        cleannode(child);
        child = next;
    }
}

function cssstringify(s) {
    return '"' + s.replace(/["\\]/g, '\\$&') + '"';
}

function windowspatherrorcheck(event) {
    let src = event.target.src;
    src = src.substring(8); // remove "file:///" prefix
    src = decodeURIComponent(src);
    if (src.length >= 260)
        alert('The path to the image exceeds the Windows maximum length of 260 characters');
}
