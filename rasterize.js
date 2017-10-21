/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0;
const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0;
const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/ellipsoids.json"; // ellipsoids file loc
var inputEllipsoids = getJSONFile(INPUT_SPHERES_URL, "elliposids");
var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); // default eye position in world space
var gl = null; // the all powerful gl object. It's all here folks!
var lightPos;
var ambiVertex;
var diffVertex;
var specVertex;
var normVertex;
var attrvertex;
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat4.create();
var mdMatrix = mat4.create();
mat4.lookAt(mvMatrix, [0.5, 0.5, -0.5], [0.5, 0.5, 1], [0, 1, 0]);
mat4.multiply(mvMatrix, [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], mvMatrix);
var triMatrix = [], ellipMatrix = [], triRMatrix = [], ellipRMatrix = []

var ambiBuffer;
var diffBuffer;
var specBuffer;
var nBuffer;
var normBuffer;
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples

var triBufferSize = 0; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader

var shaderProgram;
var sel_tri = -1;
sel_ell = -1;

//var triMatrix = [], ellipMatrix = [];
//var triRMatrix = [], ellipRMatrix = [];

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url, descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET", url, false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open " + descr + " file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try    

    catch (e) {
        console.log(e);
        return (String.null);
    }
} // end get json file

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    mat4.perspective(pMatrix, Math.PI / 2, gl.viewportWidth / gl.viewportHeight, 0.5, 100.0);

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try

    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL

function loadLights() {
    var light = getJSONFile("https://ncsucgclass.github.io/prog2/lights.json","light");
    lightPos = vec3.fromValues(light[0].x, light[0].y, light[0].z);
}

// read triangles in, load them into webgl buffers
function loadTriangles() {
    if (inputTriangles != String.null) {
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set

        for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
            var coordArray = []; // 1D array of vertex coords for WebGL
            var indexArray = []; // 1D array of vertex indices for WebGL
            var vtxBufferSize = 0; // the number of vertices in the vertex buffer
            var vtxToAdd = []; // vtx coords to add to the coord array
            var indexOffset = vec3.create(); // the index offset for the current set
            var triToAdd = vec3.create(); // tri indices to add to the index array

            var tri_amb = [];
            var tri_diff = [];
            var tri_spec = [];
            var nArray = [];
            var diffToAdd = [];
            var specToAdd = [];
            var ambToAdd = [];


            var normalArray = [];
            var normToAdd = [];

            var Center = vec3.create();

            vec3.set(indexOffset, vtxBufferSize, vtxBufferSize, vtxBufferSize); // update vertex offset
            triBufferSize = 0;


            // set up the vertex coord array
            for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
                

                nArray.push(inputTriangles[whichSet].material.n);
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                diffToAdd = inputTriangles[whichSet].material.diffuse;
                specToAdd = inputTriangles[whichSet].material.specular;
                ambToAdd = inputTriangles[whichSet].material.ambient;
                normToAdd = inputTriangles[whichSet].normals[whichSetVert];
                for (var i=0; i<3; i++) 
                {
                    coordArray.push(vtxToAdd[i]);
                    tri_diff.push(diffToAdd[i]);
                    tri_spec.push(specToAdd[i]);
                    tri_amb.push(ambToAdd[i]);
                    normalArray.push(normToAdd[i]);
                }
                vec3.add(Center, Center, vtxToAdd);
            } // end for vertices in set
            vec3.scale(Center, Center, 1.0 / inputTriangles[whichSet].vertices.length);

            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd, indexOffset, inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0], triToAdd[1], triToAdd[2]);
            } // end for triangles in set

            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
            triBufferSize += inputTriangles[whichSet].triangles.length; // total number of tris

            triBufferSize *= 3; // now total number of indices

            // send the vertex coords to webGL
            vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer
            // send the triangle indices to webGL
            triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // indices to that buffer

            
            nBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nArray), gl.STATIC_DRAW);
            normBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

            diffBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, diffBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tri_diff), gl.STATIC_DRAW);
            specBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, specBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tri_spec), gl.STATIC_DRAW);
            ambiBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, ambiBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tri_amb), gl.STATIC_DRAW);

            // console.log("coordinates: "+coordArray.toString());
            // console.log("numverts: "+vtxBufferSize);
            // console.log("indices: "+indexArray.toString());
            // console.log("numindices: "+triBufferSize);
        
            mdMatrix = mat4.create();

            if (sel_tri == whichSet) {
                mdMatrix = mat4.multiply(mat4.create(),
                    mat4.fromTranslation(mat4.create(), vec3.scale(vec3.create(), Center, -1)),
                    mdMatrix);
                mdMatrix = mat4.multiply(mat4.create(),
                    mat4.scale(mat4.create(), mat4.create(), [1.2, 1.2, 1.2]),
                    mdMatrix);
                mdMatrix = mat4.multiply(mat4.create(),
                    mat4.fromTranslation(mat4.create(), Center),
                    mdMatrix);
            }
            mdMatrix = mat4.multiply(mat4.create(),
                mat4.fromTranslation(mat4.create(), vec3.scale(vec3.create(), Center, -1)),
                mdMatrix);
            mat4.multiply(mdMatrix, triRMatrix[whichSet], mdMatrix);
            mdMatrix = mat4.multiply(mat4.create(),
                mat4.fromTranslation(mat4.create(), Center),
                mdMatrix);

            mat4.multiply(mdMatrix, triMatrix[whichSet], mdMatrix);
            gl.uniform1i(shaderProgram.lightModelUniform, inputTriangles[whichSet].lightModel);

            renderTriangles();
        } // end for each triangle set

    } // end if triangles found
} // end load triangles

function loadEllipsoids() {
    if (inputEllipsoids != String.null) {
        var latitudeBands = 70;
        var longitudeBands = 15;

        for (var whichSet = 0; whichSet < inputEllipsoids.length; whichSet++) {
            var coordArray = [];
            var indexArray = [];
            var normalArray = [];

            var elli_ambi = [];
            var elli_diff = [];
            var elli_spec = [];
            var nArray = [];
            var diffToAdd = [];
            var specToAdd = [];
            var ambToAdd = [];
            
            let para = {
                X : inputEllipsoids[whichSet].x,
                Y : inputEllipsoids[whichSet].y,
                Z : inputEllipsoids[whichSet].z,
                a : inputEllipsoids[whichSet].a,
                b : inputEllipsoids[whichSet].b,
                c : inputEllipsoids[whichSet].c
            }
            

            var Center = vec3.fromValues(para['X'], para['Y'], para['Z']);

            for (var latNumber = 0; latNumber <= latitudeBands; latNumber++) {
                var theta = latNumber * Math.PI / latitudeBands;
                var sinTheta = Math.sin(theta);
                var cosTheta = Math.cos(theta);

                for (var longNumber = 0; longNumber <= longitudeBands; longNumber++) {
                    diffToAdd = inputEllipsoids[whichSet].diffuse;
                    specToAdd = inputEllipsoids[whichSet].specular;
                    ambToAdd = inputEllipsoids[whichSet].ambient;
                    nArray.push(inputEllipsoids[whichSet].n);
                    

                    for (var i=0; i<3; i++) 
                    {
                        elli_diff.push(diffToAdd[i]);
                        elli_spec.push(specToAdd[i]);
                        elli_ambi.push(ambToAdd[i]);
                    }

                    var phi = longNumber * 2 * Math.PI / longitudeBands;
                    var sinPhi = Math.sin(phi);
                    var cosPhi = Math.cos(phi);
                    var x = cosPhi * sinTheta;
                    var y = cosTheta;
                    var z = sinPhi * sinTheta;
                    var elli_normal = [2 * x / para['a'], 2 * y / para['b'], 2 * z / para['c']]
                    coordArray.push(para['X'] + para['a'] * x, para['Y'] + para['b'] * y, para['Z'] + para['c'] * z);

                    for(var p=0; p < elli_normal.length; p++){
                    normalArray.push(elli_normal[p]);
                    }

                }
            }


            for (var latNumber = 0; latNumber < latitudeBands; latNumber++) {
                for (var longNumber = 0; longNumber < longitudeBands; longNumber++) {
                    var first = (latNumber * (longitudeBands + 1)) + longNumber;
                    var second = first + longitudeBands + 1;
                    indexArray.push(first);
                    indexArray.push(second);
                    indexArray.push(first + 1);
                    indexArray.push(second);
                    indexArray.push(second + 1);
                    indexArray.push(first + 1);
                }
            }
            triBufferSize = indexArray.length;

            // send the vertex coords to webGL
            vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer

            // send the triangle indices to webGL
            triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // indices to that buffer

            ambiBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, ambiBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(elli_ambi), gl.STATIC_DRAW);

            diffBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, diffBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(elli_diff), gl.STATIC_DRAW);

            specBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, specBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(elli_spec), gl.STATIC_DRAW);

            nBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nArray), gl.STATIC_DRAW);

            normBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);


            mdMatrix = mat4.create();
            if (sel_ell == whichSet) {
                mdMatrix = mat4.multiply(mat4.create(),
                    mat4.fromTranslation(mat4.create(), vec3.scale(vec3.create(), Center, -1)),
                    mdMatrix);
                mdMatrix = mat4.multiply(mat4.create(),
                    mat4.scale(mat4.create(), mat4.create(), [1.2, 1.2, 1.2]),
                    mdMatrix);
                mdMatrix = mat4.multiply(mat4.create(),
                    mat4.fromTranslation(mat4.create(), Center),
                    mdMatrix);
            }
            mdMatrix = mat4.multiply(mat4.create(),
                mat4.fromTranslation(mat4.create(), vec3.scale(vec3.create(), Center, -1)),
                mdMatrix);
            mat4.multiply(mdMatrix, ellipRMatrix[whichSet], mdMatrix);
            mdMatrix = mat4.multiply(mat4.create(),
                mat4.fromTranslation(mat4.create(), Center),
                mdMatrix);

            mat4.multiply(mdMatrix, ellipMatrix[whichSet], mdMatrix);
            gl.uniform1i(shaderProgram.lightModelUniform, inputEllipsoids[whichSet].lightModel);
            renderTriangles();
        }


    }
}

// setup the webGL shaders
function setupShaders() {

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;
        
         varying vec3 ambColor;
         varying vec3 diffColor;
         varying vec3 specColor;
         varying vec3 light_coord;
         varying float pow_n;
         
         varying vec3 Global_vertexPosition; 
         varying vec3 Global_vertexNormal;
         
         uniform int lightOn;
         
         void main(void) {
            vec3 N = normalize(Global_vertexNormal);
            vec3 V = normalize( vec3(0.5,0.5,-0.5) - Global_vertexPosition );
            vec3 L = normalize( light_coord - Global_vertexPosition );
            vec3 H = normalize(V + L);
            vec3 R = normalize(2.0 * N * dot(N,L) - L);
            if(dot(N,V) < 0.0) N = -N;
            float NdotL = dot(N,L);
            float NdotH = dot(H,N);
            float RdotV = dot(R, V);
            float blinnphong = 0.0;
            
            vec3 ambient = ambColor;
            if(NdotL>0.0)
            {
                if(lightOn == 0) blinnphong = pow(NdotH, pow_n);
                if(lightOn == 1) blinnphong = pow(RdotV, pow_n);   
            }
            
            gl_FragColor = vec4(ambient + NdotL * diffColor + blinnphong * specColor, 1.0);
            
         }
    `;

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
         attribute vec3 vertexPosition;
         attribute vec3 vertexAmbi;
         attribute vec3 vertexSpec;
         attribute vec3 vertexDiff;
         attribute vec3 vertexNormal;
         attribute float VertexN;
         
         uniform mat4 uMVMatrix;
         uniform mat4 uPMatrix;
         uniform mat4 uNMatrix;
         uniform mat4 uMDMatrix;
         uniform vec3 uLightPos;
         
         varying vec3 Global_vertexPosition; 
         varying vec3 ambColor;
         varying vec3 diffColor;
         varying vec3 specColor;
         varying float pow_n;
         varying vec3 Global_vertexNormal;
         varying vec3 light_coord;
         
          void main(void) {
             
             vec4 vertPos4 = uMVMatrix * uMDMatrix * vec4(vertexPosition, 1.0);
             Global_vertexPosition = vec3(vertPos4) / vertPos4.w;
             ambColor = vertexAmbi;
             diffColor = vertexDiff;
             specColor = vertexSpec;
             pow_n = VertexN;
             Global_vertexNormal = vec3(uNMatrix * vec4(vertexNormal,0.0));
             light_coord = vec3(uMVMatrix * vec4(uLightPos,1.0));
             gl_Position = uPMatrix * uMVMatrix * uMDMatrix * vec4(vertexPosition, 1.0); 
          }
    `;

    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition");
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                ambiVertex = gl.getAttribLocation(shaderProgram, "vertexAmbi");
                gl.enableVertexAttribArray(ambiVertex);

                specVertex = gl.getAttribLocation(shaderProgram, "vertexSpec");
                gl.enableVertexAttribArray(specVertex);

                diffVertex = gl.getAttribLocation(shaderProgram, "vertexDiff");
                gl.enableVertexAttribArray(diffVertex);

                normVertex = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(normVertex);

                attrvertex = gl.getAttribLocation(shaderProgram, "VertexN");
                gl.enableVertexAttribArray(attrvertex);

                shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
                shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
                shaderProgram.lightVecUniform = gl.getUniformLocation(shaderProgram, "uLightPos");
                shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
                shaderProgram.mdMatrixUniform = gl.getUniformLocation(shaderProgram, "uMDMatrix");
                shaderProgram.lightModelUniform = gl.getUniformLocation(shaderProgram, "lightOn");
            } // end if no shader program link errors
        } // end if no compile errors
        for (var i = 0; i < inputTriangles.length; i++) {
        triMatrix.push(mat4.create());
        triRMatrix.push(mat4.create());
        inputTriangles[i].lightModel = 0;
    }

    for (var i = 0; i < inputEllipsoids.length; i++) {
        ellipMatrix.push(mat4.create());
        ellipRMatrix.push(mat4.create());
        inputEllipsoids[i].lightModel = 0;
    }
    } // end try 

    catch (e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderTriangles() {
    
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
    gl.uniformMatrix4fv(shaderProgram.mdMatrixUniform, false, mdMatrix);
    gl.uniform3fv(shaderProgram.lightVecUniform, lightPos);
    mat4.invert(nMatrix, mat4.multiply(nMatrix, mvMatrix, mdMatrix));
    mat4.transpose(nMatrix, nMatrix);
    gl.uniformMatrix4fv(shaderProgram.nMatrixUniform, false, nMatrix);

    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0); // feed

    gl.bindBuffer(gl.ARRAY_BUFFER, ambiBuffer);
    gl.vertexAttribPointer(ambiVertex, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, diffBuffer);
    gl.vertexAttribPointer(diffVertex, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, specBuffer);
    gl.vertexAttribPointer(specVertex, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.vertexAttribPointer(normVertex, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.vertexAttribPointer(attrvertex, 1, gl.FLOAT, false, 0, 0);

    // triangle buffer: activate and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0); // render

} // end render triangles

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    loadTriangles();
    loadEllipsoids();
}

//interactive part
function handleKeyDown(event) {
    switch (event.key) {
        case 'a':
            mat4.multiply(mvMatrix, mat4.fromTranslation(mat4.create(), [0.1, 0, 0]), mvMatrix);
            drawScene();
            break;
        case 'd':
            mat4.multiply(mvMatrix, mat4.fromTranslation(mat4.create(), [-0.1, 0, 0]), mvMatrix);
            drawScene();
            break;
        case 'w':
            mat4.multiply(mvMatrix, mat4.fromTranslation(mat4.create(), [0, 0, 0.1]), mvMatrix);
            drawScene();
            break;
        case 's':
            mat4.multiply(mvMatrix, mat4.fromTranslation(mat4.create(), [0, 0, -0.1]), mvMatrix);
            drawScene();
            break;
        case 'q':
            mat4.multiply(mvMatrix, mat4.fromTranslation(mat4.create(), [0, 0.1, 0.0]), mvMatrix);
            drawScene();
            break;
        case 'e':
            mat4.multiply(mvMatrix, mat4.fromTranslation(mat4.create(), [0, -0.1, 0.0]), mvMatrix);
            drawScene();
            break;
        case 'A':
            mat4.multiply(mvMatrix, mat4.fromYRotation(mat4.create(), -10 * Math.PI / 180), mvMatrix);
            drawScene();
            break;
        case 'D':
            mat4.multiply(mvMatrix, mat4.fromYRotation(mat4.create(), 10 * Math.PI / 180), mvMatrix);
            drawScene();
            break;
        case 'W':
            mat4.multiply(mvMatrix, mat4.fromXRotation(mat4.create(), -10 * Math.PI / 180), mvMatrix);
            drawScene();
            break;
        case 'S':
            mat4.multiply(mvMatrix, mat4.fromXRotation(mat4.create(), 10 * Math.PI / 180), mvMatrix);
            drawScene();
            break;

        case "ArrowLeft":    // left — select and highlight the previous triangle set (previous off)
            sel_ell = -1;
            sel_tri = (sel_tri + 1) % 2;
            drawScene();
            break;
        case "ArrowRight":    // right — select and highlight the next triangle set (previous off)
            sel_ell = -1;
            sel_tri = sel_tri == -1 ? 1 : (sel_tri + 1) % 2;
            drawScene();
            break;
        case "ArrowUp":    // left — select and highlight the previous triangle set (previous off)
            sel_tri = -1;
            sel_ell = (sel_ell + 1) % 3;
            drawScene();
            break;
        case "ArrowDown":    // right — select and highlight the next triangle set (previous off)
            sel_tri = -1;
            sel_ell = (sel_ell + 2) % 3;
            drawScene();
            break;
        case " ":
            sel_tri = sel_ell = -1;
            drawScene();
            break;
    }
    if (sel_tri != -1 || sel_ell != -1) {
        switch (event.key) {
            case 'b':
                if (sel_tri != -1) {
                    inputTriangles[sel_tri].lightModel = inputTriangles[sel_tri].lightModel == 0 ? 1 : 0;
                } else {
                    inputEllipsoids[sel_ell].lightModel = inputEllipsoids[sel_ell].lightModel == 0 ? 1 : 0;
                }
                drawScene();
                break;
            case 'n':
                if (sel_tri != -1) {
                    inputTriangles[sel_tri].material.n = (inputTriangles[sel_tri].material.n + 1) % 21;
                } else {
                    inputEllipsoids[sel_ell].n = (inputEllipsoids[sel_ell].n + 1) % 21;
                }
                drawScene();
                break;
            case '1':
                if (sel_tri != -1) {
                    for (var i = 0; i < 3; i++) {
                        inputTriangles[sel_tri].material.ambient[i] += 0.1;
                        if (inputTriangles[sel_tri].material.ambient[i] > 1) inputTriangles[sel_tri].material.ambient[i] = 0.0;
                    }
                } else {
                    for (var i = 0; i < 3; i++) {
                        inputEllipsoids[sel_ell].ambient[i] += 0.1;
                        if (inputEllipsoids[sel_ell].ambient[i] > 1) inputEllipsoids[sel_ell].ambient[i] = 0.0;
                    }
                }
                drawScene();
                break;

            case '2':
                if (sel_tri != -1) {
                    for (var i = 0; i < 3; i++) {
                        inputTriangles[sel_tri].material.diffuse[i] += 0.1;
                        if (inputTriangles[sel_tri].material.diffuse[i] > 1) inputTriangles[sel_tri].material.diffuse[i] = 0.0;
                    }
                } else {
                    for (var i = 0; i < 3; i++) {
                        inputEllipsoids[sel_ell].diffuse[i] += 0.1;
                        if (inputEllipsoids[sel_ell].diffuse[i] > 1) inputEllipsoids[sel_ell].diffuse[i] = 0.0;
                    }
                }
                drawScene();
                break;

            case '3':
                if (sel_tri != -1) {
                    for (var i = 0; i < 3; i++) {
                        inputTriangles[sel_tri].material.specular[i] += 0.1;
                        if (inputTriangles[sel_tri].material.specular[i] > 1) inputTriangles[sel_tri].material.specular[i] = 0.0;
                    }
                } else {
                    for (var i = 0; i < 3; i++) {
                        inputEllipsoids[sel_ell].specular[i] += 0.1;
                        if (inputEllipsoids[sel_ell].specular[i] > 1) inputEllipsoids[sel_ell].specular[i] = 0.0;
                    }
                }
                drawScene();
                break;
            case 'k':
                if (sel_tri != -1) {
                    mat4.multiply(triMatrix[sel_tri], mat4.fromTranslation(mat4.create(), [0.1, 0, 0]), triMatrix[sel_tri]);
                } else {
                    mat4.multiply(ellipMatrix[sel_ell], mat4.fromTranslation(mat4.create(), [0.1, 0, 0]), ellipMatrix[sel_ell]);
                }
                drawScene();
                break;
            case ';':
                if (sel_tri != -1) {
                    mat4.multiply(triMatrix[sel_tri], mat4.fromTranslation(mat4.create(), [-0.1, 0, 0]), triMatrix[sel_tri]);
                } else {
                    mat4.multiply(ellipMatrix[sel_ell], mat4.fromTranslation(mat4.create(), [-0.1, 0, 0]), ellipMatrix[sel_ell]);
                }
                drawScene();
                break;
            case 'o':
                if (sel_tri != -1) {
                    mat4.multiply(triMatrix[sel_tri], mat4.fromTranslation(mat4.create(), [0, 0, 0.1]), triMatrix[sel_tri]);
                } else {
                    mat4.multiply(ellipMatrix[sel_ell], mat4.fromTranslation(mat4.create(), [0, 0, 0.1]), ellipMatrix[sel_ell]);
                }
                drawScene();
                break;
            case 'l':
                if (sel_tri != -1) {
                    mat4.multiply(triMatrix[sel_tri], mat4.fromTranslation(mat4.create(), [0.0, 0, -0.1]), triMatrix[sel_tri]);
                } else {
                    mat4.multiply(ellipMatrix[sel_ell], mat4.fromTranslation(mat4.create(), [0.0, 0, -0.1]), ellipMatrix[sel_ell]);
                }
                drawScene();
                break;
            case 'i':
                if (sel_tri != -1) {
                    mat4.multiply(triMatrix[sel_tri], mat4.fromTranslation(mat4.create(), [0, 0.1, 0]), triMatrix[sel_tri]);
                } else {
                    mat4.multiply(ellipMatrix[sel_ell], mat4.fromTranslation(mat4.create(), [0, 0.1, 0]), ellipMatrix[sel_ell]);
                }
                drawScene();
                break;
            case 'p':
                if (sel_tri != -1) {
                    mat4.multiply(triMatrix[sel_tri], mat4.fromTranslation(mat4.create(), [0.0, -0.1, 0]), triMatrix[sel_tri]);
                } else {
                    mat4.multiply(ellipMatrix[sel_ell], mat4.fromTranslation(mat4.create(), [0.0, -0.1, 0]), ellipMatrix[sel_ell]);
                }
                drawScene();
                break;

            case 'K':
                if (sel_tri != -1)
                    mat4.multiply(triRMatrix[sel_tri], mat4.fromYRotation(mat4.create(), 10 * Math.PI / 180), triRMatrix[sel_tri]);
                else
                    mat4.multiply(ellipRMatrix[sel_ell], mat4.fromYRotation(mat4.create(), 10 * Math.PI / 180), ellipRMatrix[sel_ell]);
                drawScene();
                break;
            case ':':
                if (sel_tri != -1)
                    mat4.multiply(triRMatrix[sel_tri], mat4.fromYRotation(mat4.create(), -10 * Math.PI / 180), triRMatrix[sel_tri]);
                else
                    mat4.multiply(ellipRMatrix[sel_ell], mat4.fromYRotation(mat4.create(), -10 * Math.PI / 180), ellipRMatrix[sel_ell]);
                drawScene();
                break;
            case 'O':
                if (sel_tri != -1)
                    mat4.multiply(triRMatrix[sel_tri], mat4.fromXRotation(mat4.create(), 10 * Math.PI / 180), triRMatrix[sel_tri]);
                else
                    mat4.multiply(ellipRMatrix[sel_ell], mat4.fromXRotation(mat4.create(), 10 * Math.PI / 180), ellipRMatrix[sel_ell]);
                drawScene();
                break;
            case 'L':
                if (sel_tri != -1)
                    mat4.multiply(triRMatrix[sel_tri], mat4.fromXRotation(mat4.create(), -10 * Math.PI / 180), triRMatrix[sel_tri]);
                else
                    mat4.multiply(ellipRMatrix[sel_ell], mat4.fromXRotation(mat4.create(), -10 * Math.PI / 180), ellipRMatrix[sel_ell]);
                drawScene();
                break;
            case 'I':
                if (sel_tri != -1)
                    mat4.multiply(triRMatrix[sel_tri], mat4.fromZRotation(mat4.create(), -10 * Math.PI / 180), triRMatrix[sel_tri]);
                else
                    mat4.multiply(ellipRMatrix[sel_ell], mat4.fromZRotation(mat4.create(), -10 * Math.PI / 180), ellipRMatrix[sel_ell]);
                drawScene();
                break;
            case 'P':
                if (sel_tri != -1)
                    mat4.multiply(triRMatrix[sel_tri], mat4.fromZRotation(mat4.create(), 10 * Math.PI / 180), triRMatrix[sel_tri]);
                else
                    mat4.multiply(ellipRMatrix[sel_ell], mat4.fromZRotation(mat4.create(), 10 * Math.PI / 180), ellipRMatrix[sel_ell]);
                drawScene();
                break;
        }
    }

}
/* MAIN -- HERE is where execution begins after window load */

function main() {
    setupWebGL(); // set up the webGL environment
    loadLights();
    setupShaders(); // setup the webGL shaders
    drawScene(); 
    document.onkeydown = handleKeyDown;
} // end main
