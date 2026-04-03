import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function SunburstChart({ masterData }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!masterData || !svgRef.current) return;
    
    // Transform codebook into hierarchical D3 format
    const { codebook, analyses } = masterData;
    
    // Calculate global frequencies to size the sunburst segments
    const freqs = {};
    Object.values(analyses).forEach(doc => {
      (doc.tags || []).forEach(tag => {
        freqs[tag.theme_id] = (freqs[tag.theme_id] || 0) + 1;
        if (tag.sub_code_id) {
          freqs[tag.sub_code_id] = (freqs[tag.sub_code_id] || 0) + 1;
        }
      });
    });

    const rootData = {
      name: "Corpus",
      children: codebook.themes.map(t => ({
        name: t.label,
        id: t.id,
        value: Math.max(1, freqs[t.id] || 1), // Base value if no subcodes
        children: (t.sub_codes || []).map(sc => ({
          name: sc.label,
          id: sc.id,
          value: Math.max(1, freqs[sc.id] || 1)
        }))
      }))
    };

    const width = 600;
    const radius = width / 2;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, width])
      .style("font", "10px sans-serif");

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2},${width / 2})`);

    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, rootData.children.length + 1));

    const partition = data => d3.partition()
      .size([2 * Math.PI, radius])
      (d3.hierarchy(data).sum(d => d.value).sort((a, b) => b.value - a.value));

    const root = partition(rootData);

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1 - 1);

    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip glass-panel")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("padding", "10px")
      .style("pointer-events", "none");

    g.selectAll("path")
      .data(root.descendants().filter(d => d.depth))
      .join("path")
      .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
      .attr("d", arc)
      .style("opacity", 0.8)
      .on("mouseover", function(event, d) {
        d3.select(this).style("opacity", 1).style("stroke", "#fff").style("stroke-width", 2);
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`<strong>${d.data.name}</strong><br/>Occurrences: ${d.value}`)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseleave", function(event, d) {
        d3.select(this).style("opacity", 0.8).style("stroke", "none");
        tooltip.transition().duration(500).style("opacity", 0);
      });

    g.selectAll("text")
      .data(root.descendants().filter(d => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > 10))
      .join("text")
      .attr("transform", function(d) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .attr("dy", "0.35em")
      .text(d => d.data.name.length > 15 ? d.data.name.substring(0,15)+'...' : d.data.name)
      .style("fill", "white")
      .attr("text-anchor", "middle")
      .style("pointer-events", "none");

    return () => d3.selectAll(".tooltip").remove();
  }, [masterData]);

  return <svg ref={svgRef}></svg>;
}
