import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function HeatmapChart({ masterData }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!masterData || !svgRef.current) return;
    const { codebook, analyses } = masterData;

    // Prep Data: Docs (y-axis) vs Themes (x-axis)
    const docNames = Object.keys(analyses).filter(d => !analyses[d].error);
    const themeIds = codebook.themes.map(t => t.id);
    const themeLabels = codebook.themes.map(t => t.label);

    const margin = { top: 100, right: 30, bottom: 30, left: 150 };
    const width = Math.max(600, themeIds.length * 60) - margin.left - margin.right;
    const height = Math.max(400, docNames.length * 40) - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove(); // clear

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Build X scales (Themes)
    const x = d3.scaleBand()
      .range([0, width])
      .domain(themeLabels)
      .padding(0.05);
      
    // Rotate x-axis labels
    svg.append("g")
      .style("font-size", 12)
      .style("color", "var(--text-muted)")
      .call(d3.axisTop(x).tickSize(0))
      .select(".domain").remove();
      
    svg.selectAll("text")
      .attr("transform", "translate(-10,-10)rotate(-45)")
      .style("text-anchor", "start");

    // Build Y scales (Docs)
    const y = d3.scaleBand()
      .range([height, 0])
      .domain(docNames)
      .padding(0.05);
      
    svg.append("g")
      .style("font-size", 12)
      .style("color", "var(--text-muted)")
      .call(d3.axisLeft(y).tickSize(0))
      .select(".domain").remove();

    // Color Scale (Intensity 0-5) -> 0=bg, 5=primary/accent intense
    const myColor = d3.scaleSequential()
      .interpolator(d3.interpolateYlGnBu)
      .domain([0, 5]);

    // Format Data for Matrix
    const matrixData = [];
    docNames.forEach((doc) => {
      const tags = analyses[doc].tags || [];
      themeIds.forEach((tId, tIdx) => {
        const matchingTags = tags.filter(tg => tg.theme_id === tId);
        // Take highest intensity if multiple
        const intensity = matchingTags.length ? Math.max(...matchingTags.map(m => m.intensity)) : 0;
        matrixData.push({
          doc,
          themeLabel: themeLabels[tIdx],
          intensity
        });
      });
    });

    // Tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip glass-panel")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("padding", "10px")
      .style("pointer-events", "none");

    // Draw Rects
    svg.selectAll()
      .data(matrixData)
      .enter()
      .append("rect")
      .attr("x", d => x(d.themeLabel))
      .attr("y", d => y(d.doc))
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .style("fill", d => d.intensity === 0 ? 'rgba(255,255,255,0.05)' : myColor(d.intensity))
      .style("stroke-width", 4)
      .style("stroke", "none")
      .style("opacity", 0.8)
      .on("mouseover", function(event, d) {
        d3.select(this)
          .style("stroke", "var(--accent)")
          .style("opacity", 1);
        tooltip.transition().duration(200).style("opacity", .9);
        tooltip.html(`<strong>${d.themeLabel}</strong><br/>Doc: ${d.doc}<br/>Intensity: ${d.intensity}`)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseleave", function(event, d) {
        d3.select(this)
          .style("stroke", "none")
          .style("opacity", 0.8);
        tooltip.transition().duration(500).style("opacity", 0);
      });

    return () => d3.selectAll(".tooltip").remove();
  }, [masterData]);

  return <div style={{width:'100%', overflowX:'auto'}}><svg ref={svgRef}></svg></div>;
}
