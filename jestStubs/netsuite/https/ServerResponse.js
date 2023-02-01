define([], function() {

    /**
     * Encapsulates the response of an HTTP(S) server (for example, Suitelet or RESTlet) to an HTTPS request from a server, such as a user event script.
     *
     * @protected
     * @classDescription Encapsulation of the response returned by a web server as a response to our HTTP request.
     * @return {http.ServerResponse}
     * @constructor
     *
     * @since 2015.2
     */
    var ServerResponse = function() {
        this.headers;
    };

    /**
     * Adds a header to the response
     * 
     * @returns void
     *
     * @since 2015.2
     */
    ServerResponse.prototype.addHeader = function(options) {};

    /**
     * Generates and renders a PDF directly to the response
     * 
     * @returns void
     *
     * @since 2015.2
     */
    ServerResponse.prototype.renderPdf = function(options) {};

    /**
     * Sets the redirect URL by resolving to a NetSuite resource
     * 
     * @returns void
     *
     * @since 2015.2
     */
    ServerResponse.prototype.sendRedirect = function(options) {
        /* options object:
            {
                identifier: number | string*,
                type: string*,
                editMode: boolean,
                id: string,
                parameters: object
            }
        */
    };

    
    /**
     * Sets CDN caching for a period of time.
     * 
     * @returns void
     *
     * @since 2015.2
     */
    ServerResponse.prototype.setCdnCacheable = function(options) {};

    /**
     * Sets the value of a response header.
     * 
     * @returns void
     *
     * @since 2015.2
     */
    ServerResponse.prototype.setHeader = function(options) {};

    /**
     * Writes information (text/xml/html) to the response.
     * 
     * @returns void
     *
     * @since 2015.2
     */
    ServerResponse.prototype.write = function(options) {};

    /**
     * Writes a file to the response.
     * 
     * @returns void
     *
     * @since 2015.2
     */
    ServerResponse.prototype.writeFile = function(options) {};

    /**
     * Writes line information (text/xml/html) to the response.
     * 
     * @returns void
     *
     * @since 2015.2
     */
    ServerResponse.prototype.writeLine = function(options) {};

    /**
     * Generates a page.
     * 
     * @returns void
     *
     * @since 2015.2
     */
    ServerResponse.prototype.writePage = function(options) {};

    /**
     * get JSON format of the object
     * @governance none
     * @returns {{type: string, code: *, headers: *, body: *}}
     *
     * @since 2015.2
     */
    ServerResponse.prototype.toJSON = function() {};

    return { ServerResponse: new ServerResponse()};
});
