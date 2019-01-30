define(function(require){
    const p4 = require('p4/core/pipeline');
    const BarChart = require('i2v/charts/bar');
    // const colorScheme = require('./color-scheme');
    // const geoMap = require('./geomap');
    const temporalPlot = require('./temporal-plot');
    var fly = false;

    function createView(containerId, callback) {
        var svgString = new XMLSerializer().serializeToString(document.querySelector('#'+ containerId+' svg'));

        var canvas = document.getElementById("canvas-"+containerId);

        var ctx = canvas.getContext("2d");
        var DOMURL = self.URL || self.webkitURL || self;
        var svg = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
        var url = DOMURL.createObjectURL(svg);


        var img = new Image();
        img.onload = function() {
            ctx.drawImage(img, 0, 0);
            var png = canvas.toDataURL("image/png");

            if(typeof callback == 'function') {
                callback(png);
            }
            DOMURL.revokeObjectURL(png);
        };
        img.src = url;
        return canvas;
    }

    function updateViews() {
        createView('group-by-gname', function(png){
            document.querySelector('#side-panel1').setAttribute('src', png);
        })

        createView('group-by-attacktype', function(png){
            document.querySelector('#side-panel2').setAttribute('src', png);
        })

        createView('timeline-view', function(png){
            document.querySelector('#timeline').setAttribute('src', png);
        })
    }

    return function(data, gmap) {
        var colorMap = d3.scaleOrdinal(d3.schemeCategory10);
        var locs = [];
        console.log(gmap);

        var terroristGroups = p4()
            .aggregate({
                $group: 'gname',
                attacks: {$count: '*'},
                // attacks: {$sum: 'nkill'}
            })
            .sortBy({attacks: -1})
            .execute(data)
            .slice(1, 10);

        new BarChart({
            data: terroristGroups,
            width: 400,
            height: 600,
            padding: {top:100, bottom: 50, left: 180, right: 50},
            vmap: {
                y: 'gname',
                size: 'attacks',
                x: 'attacks',
                color: 'gname'
            },

            colorMap: colorMap,
            titleY: 'Terrorist Group',
            formatY: function(d) {
                var reg = new RegExp(/\((.*)\)/);
                var match = d.match(reg);
                if(match !== null) {
                    return match[1];
                } else {
                    if(d.length > 12)
                        return d.slice(0, 12) + '...';
                    else
                        return d;
                };
            },
            container: 'group-by-gname'
        })

        var res = p4()
            .aggregate({
                $group: 'attacktype',
                attacks: {$count: '*'},

            })
            .sortBy({attacks: -1})
            .execute(data)
            .slice(0, 10);

        function formatName(d) {
            var reg = new RegExp(/\((.*)\)/);
            var match = d.match(reg);
            if(match !== null) {
                return match[1];
            } else {
                if(d.length > 16)
                    return d.slice(0, 16) + '...';
                else
                    return d;
            };
        }

        new BarChart({
            data: res,
            width: 400,
            height: 600,
            padding: {top:100, bottom: 50, left: 180, right: 50},
            color: 'teal',
            vmap: {
                y: 'attacktype',
                size: 'attacks',
                x: 'attacks'
            },
            titleY: 'Attack Types',
            formatY: formatName,
            container: 'group-by-attacktype'
        })

        gmap.removeLocations(locs);
        locs = data;
        console.log(locs);
        gmap.addLocations(locs, {
            vmap:{lat: 'latitude', long: 'longitude', color: 'gname'},
            colorMap: colorMap
        });

        let calcLocsRect = locs => {
            let minmax = R.reduce((acc, loc) => {
                let lat = parseFloat(loc.latitude);
                let long = parseFloat(loc.longitude);
                return {
                    min: {
                        lat: Math.min(acc.min.lat, lat),
                        long: Math.min(acc.min.long, long)
                    },
                    max: {
                        lat: Math.max(acc.max.lat, lat),
                        long: Math.max(acc.max.long, long)
                    }
                }
            }, {
                min: {
                    lat: Number.POSITIVE_INFINITY,
                    long: Number.POSITIVE_INFINITY,
                },
                max: {
                    lat: Number.NEGATIVE_INFINITY,
                    long: Number.NEGATIVE_INFINITY,
                }
            }, locs);
            return minmax;
        }

        let fitLocations = (locs) => {
            let minmax = calcLocsRect(locs);
            gmap.fitBounds([
                [minmax.min.lat, minmax.min.long],
                [minmax.max.lat, minmax.max.long]
            ]);
        }

        fitLocations(locs);
        // if(fly) {
        //     flyToLocations(locs);
        // } else {
        //     fly = true;
        // }

        var tdata = p4()
            .match({
              gname: {$in: terroristGroups.slice(0,4).map(d=>d.gname)},
            })
            .aggregate({
              $group: ['iyear', 'gname'],
              count: {$count: '*'}
            })
            .execute(data);

        console.log(tdata);

        var splot1 = new temporalPlot({
            container: 'timeline-view',
            height: 300,
            width: 800,
            padding: {left: 150, right: 40, top: 30, bottom: 60},
            data:  tdata,
            colors: colorMap,
            vmap: {
                x: 'iyear',
                y: 'gname',
                size: 'count',
                color: 'gname',
            },
            formatX: d=>d,
            formatY: formatName
        })


         updateViews();



        gmap.once("moveend zoomend", function() {
            gmap.exportAsImage(function(blob){
              document.querySelector('#main-panel').setAttribute('src', blob);
            });
        });


    };
})
