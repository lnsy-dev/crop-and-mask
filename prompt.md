We are building a single page webpage called "crop-and-mask".

It should allow users to upload a file. It should then create a canvas the size of the image. It should allow users to then adjust the crop of the canvas file (including increasing the size). 

The file upload should limit what files the user can upload to a file format compatible with the canvas editor. 

It should also have brushes that create or remove a mask. the brushes should be resizeable in the gui, and the cursor in brush mode should show the exact brush size. 

Users should be able to zoom in and out of the image and fit the image in the window. 

It should have buttons to use opencv (@src/opencv.js) to remove the background of images and other subtractive tools for handling images. 

https://docs.opencv.org/4.x/d0/d84/tutorial_js_usage.html

We should be able to download images with a button. The output should be a png with a transparent background. 

The aesthethics should be monochrome and minmalist and use the Fira Code font. 