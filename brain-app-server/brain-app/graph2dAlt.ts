

declare var cytoscape;

class Graph2DAlt {
    id: number;
    jDiv;
    dataSet: DataSet;

    svg;
    svgDefs;
    svgAllElements;

    // Data
    commonData;

    nodes: any[];
    links: any[];

    cy;

    constructor(id: number, jDiv, dataSet: DataSet, svg, svgDefs, svgGroup, commonData) {
        this.nodes = [];
        this.links = [];

        this.svg = svg;
        this.svgDefs = svgDefs;
        this.svgAllElements = svgGroup;
        this.id = id;
        this.jDiv = jDiv;
        this.dataSet = dataSet;
        
        this.commonData = commonData;

        this.cy = cytoscape({
            container: jDiv
        });
    }
}
