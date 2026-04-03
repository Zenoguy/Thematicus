import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function RadarChart({ masterData }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!masterData || !svgRef.current) return;
    const { codebook, analyses } = masterData;

    // Calculate average intensity per theme across all docs
    const docs = Object.values(analyses).filter(a => !a.error);
    const themeAverages = codebook.themes.map(t => {
      let sum = 0;
      let count = 0;
      docs.forEach(doc => {
        const matches = (doc.tags || []).filter(tg => tg.theme_id === t.id);
        if (matches.length > 0) {
          sum += Math.max(...matches.map(m => m.intensity));
          count++;
        }
      });
      return { 
        axis: t.label.length > 15 ? t.label.substring(0,15)+'...' : t.label, 
        value: count === 0 ? 0 : sum / count 
      };
    }).sort((a,b) => b.value - a.value).slice(0, 8); // Top 8 themes max

    if (themeAverages.length < 3) {
      d3.select(svgRef.current).selectAll('*').remove();
      return; // Need at least 3 axes for a radar
    }

    const data = [themeAverages]; // Format for multi-layered spiders, we just need 1 layer

    const margin = {top: 50, right: 50, bottom: 50, left: 50},
          width = 500,
          height = 500,
          radius = Math.min(width/2, height/2);

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${width/2 + margin.left}, ${height/2 + margin.top})`);

    const angleSlice = Math.PI * 2 / themeAverages.length;
    const rScale = d3.scaleLinear().range([0, radius]).domain([0, 5]); // Max intensity is 5

    // Draw Circular Grid
    const axisGrid = svg.append("g").attr("class", "axisWrapper");
    axisGrid.selectAll(".levels")
      .data(d3.range(1, 6).reverse())
      .enter()
      .append("circle")
      .attr("class", "gridCircle")
      .attr("r", d => radius/5 * d)
      .style("fill", "#CDCDCD")
      .style("stroke", "#CDCDCD")
      .style("fill-opacity", 0.05);

    // Draw Axes
    const axis = axisGrid.selectAll(".axis")
      .data(themeAverages)
      .enter()
      .append("g")
      .attr("class", "axis");

    axis.append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", (d, i) => rScale(5) * Math.cos(angleSlice*i - Math.PI/2))
      .attr("y2", (d, i) => rScale(5) * Math.sin(angleSlice*i - Math.PI/2))
      .style("stroke", "rgba(255,255,255,0.2)")
      .style("stroke-width", "1px");

    // Axis Labels
    axis.append("text")
      .attr("class", "legend")
      .style("font-size", "11px")
      .attr("text-anchor", "middle")
      .style("fill", "var(--text-muted)")
      .attr("dy", "0.35em")
      .attr("x", (d, i) => rScale(5.8) * Math.cos(angleSlice*i - Math.PI/2))
      .attr("y", (d, i) => rScale(5.8) * Math.sin(angleSlice*i - Math.PI/2))
      .text(d => d.axis);

    // Draw Polygon
    const radarLine = d3.lineRadial()
      .angle((d,i) => i * angleSlice)
      .radius(d => rScale(d.value))
      .curve(d3.curveLinearClosed);

    svg.selectAll(".radarWrapper")
      .data(data)
      .enter().append("g")
      .attr("class", "radarWrapper")
      .append("path")
      .attr("class", "radarArea")
      .attr("d", d => radarLine(d))
      .style("fill", "var(--primary)")
      .style("fill-opacity", 0.4)
      .on('mouseover', function(){ d3.select(this).style("fill-opacity", 0.7); })
      .on('mouseout', function(){ d3.select(this).style("fill-opacity", 0.4); })
      .style("stroke-width", 2)
      .style("stroke", "var(--primary)");

  }, [masterData]);

  if (masterData && masterData.codebook?.themes?.length < 3) {
    return <div style={{ color: 'var(--text-muted)' }}>Need at least 3 themes for a Radar chart.</div>;
  }

  return <svg ref={svgRef}></svg>;
}
