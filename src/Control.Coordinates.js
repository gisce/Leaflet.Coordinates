var NumberFormatter = require("./util/NumberFormatter");

module.exports = {
  addTo: function addToLeaflet(L) {
    /*
    * L.Control.Coordinates is used for displaying current mouse coordinates on the map.
    */

    // This is pretty weird. Original author needed this Fn
    var numberFormatter = NumberFormatter(L.Util.formatNum);

    L.Control.Coordinates = L.Control.extend({
      options: {
        position: 'bottomright',
        //decimals used if not using DMS or labelFormatter functions
        decimals: 4,
        //decimalseperator used if not using DMS or labelFormatter functions
        decimalSeperator: ".",
        //funciton for converting coordinates
        // params: lng:float, lat:float, reverse:boolean
        coordinateConverter: undefined,
        //label templates for usage if no labelFormatter function is defined
        labelTemplateLat: "Lat: {y}",
        labelTemplateLng: "Lng: {x}",
        //label formatter functions
        labelFormatterLat: undefined,
        labelFormatterLng: undefined,
        //switch on/off input fields on click
        enableUserInput: true,
        //use Degree-Minute-Second
        useDMS: false,
        //if true lat-lng instead of lng-lat label ordering is used
        useLatLngOrder: false,
        //if true user given coordinates are centered directly
        centerUserCoordinates:false,
        leafletImagesPath: "/assets/images/"
      },

      onAdd: function(map) {
        this._map = map;

        var className = 'leaflet-control-coordinates',
          container = this._container = L.DomUtil.create('div', className),
          options = this.options;

        //label containers
        this._labelcontainer = L.DomUtil.create("div", "uiElement label", container);
        this._label = L.DomUtil.create("span", "labelFirst", this._labelcontainer);

        L.Icon.Default.imagePath = options.leafletImagesPath;

        //input containers
        this._inputcontainer = L.DomUtil.create("div", "uiElement input uiHidden", container);
        if (options.useLatLngOrder) {
          this._inputY = this._createInput("inputY", this._inputcontainer);
          this._inputX = this._createInput("inputX", this._inputcontainer);
        } else {
          this._inputX = this._createInput("inputX", this._inputcontainer);
          this._inputY = this._createInput("inputY", this._inputcontainer);
        }

        L.DomEvent.on(this._inputX, 'keyup', this._handleKeypress, this);
        L.DomEvent.on(this._inputY, 'keyup', this._handleKeypress, this);

        //connect to mouseevents
        map.on("mousemove", this._update, this);
        map.on('dragstart', this.collapse, this);

        map.whenReady(this._update, this);

        this._showsCoordinates = true;
        //wether or not to show inputs on click
        if (options.enableUserInput) {
          L.DomEvent.addListener(this._container, "click", this._switchUI, this);
        }

        return container;
      },

      /**
      *  Creates an input HTML element in given container with given classname
      */
      _createInput: function(classname, container) {
        var input = L.DomUtil.create("input", classname, container);
        input.type = "text";
        L.DomEvent.disableClickPropagation(input);
        return input;
      },

      _clearMarker: function() {
        this._map.removeLayer(this._marker);
      },

      /**
      *  Called onkeyup of input fields
      */
      _handleKeypress: function(e) {
        console.log('keypress');
        switch (e.keyCode) {
          case 27: //Esc
            this.collapse();
            break;
          case 13: //Enter
            this._handleSubmit();
            this.collapse();
            break;
          //default: //All keys
          //  this._handleSubmit();
          //  break;
        }
      },

      /**
      *  Called on each keyup except ESC
      */
      _handleSubmit: function() {
        var x = numberFormatter.createValidNumber(this._inputX.value, this.options.decimalSeperator);
        var y = numberFormatter.createValidNumber(this._inputY.value, this.options.decimalSeperator);
        var marker;
        var ll;
        if (x !== undefined && y !== undefined) {
          marker = this._marker;
          if (!marker) {
            marker = this._marker = L.marker();
            marker.on("click", this._clearMarker, this);
          }

          if (this.options.coordinateConverter) {
            coords = this.options.coordinateConverter(x, y, true);
            ll=new L.LatLng(coords.y, coords.x);
          } else {
            ll=new L.LatLng(y, x);
          }
          marker.setLatLng(ll);
          marker.addTo(this._map);
          if (this.options.centerUserCoordinates){
            this._map.setView(ll,this._map.getZoom());
          }
        }
      },

      /**
      *  Shows inputs fields
      */
      expand: function() {
        this._showsCoordinates = false;

        this._map.off("mousemove", this._update, this);

        L.DomEvent.addListener(this._container, "mousemove", L.DomEvent.stop);
        L.DomEvent.removeListener(this._container, "click", this._switchUI, this);

        L.DomUtil.addClass(this._labelcontainer, "uiHidden");
        L.DomUtil.removeClass(this._inputcontainer, "uiHidden");
      },

      /**
      *  Creates the label according to given options and formatters
      */
      _createCoordinateLabel: function(ll) {
        var opts = this.options,
          x, y;
        if (opts.labelFormatterLng) {
          x = opts.labelFormatterLng(ll.lng,ll.lat);
        } else if (opts.coordinateConverter) {
          x = L.Util.template(opts.labelTemplateLng, {
            x: opts.coordinateConverter(ll.lng, ll.lat).x
          });
        } else {
          x = L.Util.template(opts.labelTemplateLng, {
            x: this._getNumber(ll.lng, opts)
          });
        }
        if (opts.labelFormatterLat) {
          y = opts.labelFormatterLat(ll.lng,ll.lat);
        } else if (opts.coordinateConverter) {
          y = L.Util.template(opts.labelTemplateLat, {
            y: opts.coordinateConverter(ll.lng, ll.lat).y
          });
        } else {
          y = L.Util.template(opts.labelTemplateLat, {
            y: this._getNumber(ll.lat, opts)
          });
        }
        if (opts.useLatLngOrder) {
          return y + " " + x;
        }
        return x + " " + y;
      },

      /**
      *  Returns a Number according to options (DMS or decimal)
      */
      _getNumber: function(n, opts) {
        var res;
        if (opts.useDMS) {
          res = numberFormatter.toDMS(n);
        } else {
          res = numberFormatter.round(n, opts.decimals, opts.decimalSeperator);
        }
        return res;
      },

      /**
      *  Shows coordinate labels after user input has ended. Also
      *  displays a marker with popup at the last input position.
      */
      collapse: function() {
        if (!this._showsCoordinates) {
          this._map.on("mousemove", this._update, this);
          this._showsCoordinates = true;
          var opts = this.options;
          L.DomEvent.addListener(this._container, "click", this._switchUI, this);
          L.DomEvent.removeListener(this._container, "mousemove", L.DomEvent.stop);

          L.DomUtil.addClass(this._inputcontainer, "uiHidden");
          L.DomUtil.removeClass(this._labelcontainer, "uiHidden");

          if (this._marker) {
            var m = L.marker(),
              ll = this._marker.getLatLng();
            m.setLatLng(ll);

            var container = L.DomUtil.create("div", "");
            var label = L.DomUtil.create("div", "coordinate-label", container);
            label.innerHTML = this._createCoordinateLabel(ll);

            var close = L.DomUtil.create("a", "", container);
            close.innerHTML = "Remove";
            close.href = "#";
            var stop = L.DomEvent.stopPropagation;

            L.DomEvent
              .on(close, 'click', stop)
              .on(close, 'mousedown', stop)
              .on(close, 'dblclick', stop)
              .on(close, 'click', L.DomEvent.preventDefault)
              .on(close, 'click', function() {
              this._map.removeLayer(m);
            }, this);

            m.bindPopup(container);
            m.addTo(this._map);
            this._map.removeLayer(this._marker);
            this._marker = null;
          }
        }
      },

      /**
      *  Click callback for UI
      */
      _switchUI: function(evt) {
        L.DomEvent.stop(evt);
        L.DomEvent.stopPropagation(evt);
        L.DomEvent.preventDefault(evt);
        if (this._showsCoordinates) {
          //show textfields
          this.expand();
        } else {
          //show coordinates
          this.collapse();
        }
      },

      onRemove: function(map) {
        map.off("mousemove", this._update, this);
      },

      /**
      *  Mousemove callback function updating labels and input elements
      */
      _update: function(evt) {
        var pos = evt.latlng,
          opts = this.options;
        if (pos) {
          pos = pos.wrap();
          this._currentPos = pos;
          this._inputY.value = opts.coordinateConverter ? opts.coordinateConverter(pos.lng, pos.lat).y : numberFormatter.round(pos.lat, opts.decimals, opts.decimalSeperator);
          this._inputX.value = opts.coordinateConverter ? opts.coordinateConverter(pos.lng, pos.lat).x : numberFormatter.round(pos.lng, opts.decimals, opts.decimalSeperator);
          this._label.innerHTML = this._createCoordinateLabel(pos);
        }
      }

    });

    //construcotr registration
    L.control.coordinates = function(options) {
      return new L.Control.Coordinates(options);
    };

    //map init hook
    L.Map.mergeOptions({
      coordinateControl: false
    });

    L.Map.addInitHook(function() {
      if (this.options.coordinateControl) {
        this.coordinateControl = new L.Control.Coordinates();
        this.addControl(this.coordinateControl);
      }
    });
  }
}
