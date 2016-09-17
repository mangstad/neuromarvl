# NeuroMArVL

NeuroMArVL is a web-based tool for visualising and exploring the connectivity of brain regions, as represented in a variety of graphical forms.

It has been developed at Monash University as an initiative of the Monash Adaptive Visualisation Lab (MArVL). Contributors include:
- Tim Dwyer
- Alex Fornito
- Thanh Nhan Pham
- Mingzheng Shi
- Nicholas Smith
- James Manley


## How to use

The splash page provides a number of examples that illustrate possible useful configurations.

Closing the splash page will allow loading of data by going to the data tab and choosing to either "Load Default Data" or upload the data files.

Examples of these data files can be downloaded via "Get Example Files", which contains more detail of the format required.

You will find built-in documentation for most controls and features in the form of tooltips. These can be togled for the whole application using the "Show tips" checkbox on the lower left of the control area.

Where more detailed help is required, it is accessible by clicking on a nearby help icon that looks like: (?).


## Build instructions

The project can be built in Visual Studio 2015 with support for TypeScript and C# installed.

The built project is then deployable to an IIS server with ASP.NET.


## Future work

### Outstanding issues

See the current issue log in the Bitbucket repository for identified issues.


### Multiple views

Their has been a partial implementation of multiple views done in the past. The existing relevant code has largely been left in place. It would take a significant amount of work to complete this, and should include some redesign of the UI and workflow to accommodate it.


### Open source release

This project is a good candidate for open source release. Befor ethat can happen, however, it would need some work done to clean up the code for style consistency, and better encapsulation of components. The existing repository has an untidy history due to the merging and subsequent clean up of forks, so when a good baseline is reached it is suggested to move the project to a newly initialised public repository with a fresh history and contribution guidelines.


### Tools and architecture

At the time of writing, two significant forks have been merged to provide a more complete feature set, at the cost of some consistency in implementation. Some work was started on a complete redesign, which had to be put aside while the merge was completed. As a next step, it is worth considering a return to this redesign. 

The application is a very good candidate for common single-page-app approaches, such as React-Redux. The different graph types can be implemented as discrete components, and the graph model would work well as an immutable state managed by the overall app.

The UI could be converted easily using ReactBootstrap, which would allow the trivial remaining UI elements using jQuery UI to be removed.

The use of cytoscape.js for the 2D graph could also be extended, as it provides more than just visualisation tools, being a very useful provider of a range of graph processing tools. It is possible to have the graph kept in an immutable object that can have state managed by Redux, and apply styling as needed to produce the visual graph.


## Architectural overview

NeuroMArVL depends on a number of other projects, including:
- [cola.js](http://marvl.infotech.monash.edu/webcola/)
- [THREE.js](http://threejs.org/)
- [D3](https://d3js.org/)
- [cytoscape.js](http://js.cytoscape.org/)
- [Crossfilter](http://square.github.io/crossfilter/)
- [Bootstrap](http://getbootstrap.com/)

It is advised to become familiar with these before making significant code changes, as they can take very different approaches to visualisation and it is important to know their differences to use them effectively.

There is some inconsistency in the way some parts of the project have been implemented. This is due to the merge of different feature forks and a subsequent focus on elimination of bugs, addition of priority features, and workflow simplification rather than a complete architectural redesign. The most significant differences can be found in the visualisations. For example, the circular graph is less self contained than the 2D graph, and tends to have be updated manually through function calls scattered throughout the code. A rewrite of the circular graph would be good for consistency, but hasn't been a priority because it works. 


In the current form, NeuroMArVL has the following high level design:

#### `index.html`

Most of the UI is created statically where possible, with components enabled and disabled as needed. The biggest exception is the option menus for individual graph types, which are (mostly) self managed and created dynamically when the graph is created.


#### `style.css`

While Bootstrap is relied upon as the primary source of styling (for consistency), and customisation should be placed here. This includes some tweaks to Bootstrap as needed.

There is also a significant amount of inline styling throughout the code which could be consolidated here.


#### `extern/`

All 3rd party code has been moved to this subdirectory.

Any such sources that are compiled from TypeScript will be under `extern/ts`.


#### `brain-app/data`

The repository for numerous publicly accessible data files, such as default data sets and example files.


#### `brain-app/save` and `brain-app/save_examples`

Locations for saved configuration (those shared with a link from the app) and the examples accessible from the splash screen, respectively.


#### `brain-app/brainapp.ts`

The entry point and highest level for the app, via `defaultFunction()`.


#### `brain-app/state.ts`

Common location for the various state management classes. 

The intention is that future versions will feature multiple graph views, the data for each being kept in their own `SaveApp`. Data shared by all the views is managed by a single `CommonData` for shared configuration, and a single `DataSet`, which holds the graph data which may be empty or created from provided data files.

 The load/save of state data is faciltated by the `SaveFile` class.

 A specialised data structure for working with the matrix of attribute values is provided by the `Attributes` class.


#### `brain-app/brain3d.ts`

This file primarily contains the `Brain3dApp` class, which is responsible for a "view" area, which contains the 3D model view and the associated graph representation. 

When the multi-view feature is implemented, there would be one of these for each view.

Each instance contains a single brain model and (as needed) a single 3D graph, 2D graph and circular graph. Each of these is detailed in the respective file below.


#### `brain-app/graph3d.ts`

Contains the `Graph3D` class, which is used to implement either the brainmodel view or the 3D graph visualisation. 

Also includes the `Edge` class to manage the 3D edge objects.

There is not currently a corresponding `Node` class, however this would be useful to add here, as the current impementation heavily uses direct interaction with the low level meshes provided by Three.js, along with manually attached data on the userData property. This library is notoriously likely to change API betwen versions, so it would help to contain future issues.


#### `brain-app/graph2d.ts`

Produces the 2D graph visualisation and manages the associated options menu. It relies on cytoscape.js, which is a very powerful and flexible library for graph visualisation.


#### `brain-app/circularGraph.ts`

Similar to the 2D graph, in that it also manages a visualisation and associated menu component. It differs in that it uses D3 and SVG graphics, instead of canvas.


#### `brain-app/CommonUtilities.ts`

A collection of utility functions. The most comonly used of these is `launchAlertMessage()`, used to send a queued series of informative messages to the user.


#### `brain-app/input.ts`

A centralised source for input management, used to help manage view control, such as mediating click and drag events so they are handled by the correct component.


#### `brain-app/getapp.aspx`

Used by the query string handling to retrieve the relevant example or saved scenario from the server.


#### `brain-app/saveapp.aspx`

For sending saved configuration and data to the server.


#### `brain-app/input.ts`

For sending files to the server, such as uploaded brain model files



