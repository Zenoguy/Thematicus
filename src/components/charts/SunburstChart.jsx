import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function SunburstChart({ masterData, onSelect }) {
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

    // Dynamic Central Labels
    const centerInfo = g.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle");

    const centerLabel = centerInfo.append("text")
      .attr("y", -8)
      .style("fill", "white")
      .style("font-weight", "600")
      .style("font-size", "14px")
      .text("Corpus");

    const centerSub = centerInfo.append("text")
      .attr("y", 12)
      .style("fill", "var(--text-muted)")
      .style("font-size", "10px")
      .text("Click to Zoom Out");

    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateCool, rootData.children.length + 1));

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

    const format = d3.format(",d");

    const path = g.append("g")
      .selectAll("path")
      .data(root.descendants().filter(d => d.depth))
      .join("path")
      .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
      .attr("fill-opacity", d => (d.children ? (d.depth > 1 ? 0.6 : 0.8) : 0.4))
      .attr("d", arc);

    path.append("title")
      .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

    path.filter(d => d.children)
      .style("cursor", "pointer")
      .on("click", clicked);

    path.filter(d => !d.children)
      .style("cursor", "pointer")
      .on("click", (event, d) => onSelect?.(d.data.id));
      
    // Enhanced Hover Interactions
    path.on("mouseover", function(event, d) {
      d3.select(this)
        .transition().duration(200)
        .attr("fill-opacity", 1)
        .style("stroke", "#fff")
        .style("stroke-width", "2px");
      
      centerLabel.text(d.data.name.length > 20 ? d.data.name.substring(0, 17) + "..." : d.data.name);
      centerSub.text(`${d.value} occurrences`);
    })
    .on("mouseout", function(event, d) {
      d3.select(this)
        .transition().duration(500)
        .attr("fill-opacity", d => (d.children ? (d.depth > 1 ? 0.6 : 0.8) : 0.4))
        .style("stroke", "none");
    });

    const label = g.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none")
      .selectAll("text")
      .data(root.descendants().filter(d => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > 10))
      .join("text")
      .attr("dy", "0.35em")
      .attr("fill-opacity", d => +labelVisible(d))
      .attr("transform", d => labelTransform(d))
      .text(d => d.data.name);

    const parent = g.append("circle")
      .datum(root)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("click", clicked);

    function clicked(event, p) {
      parent.datum(p.parent || root);
      
      // Also trigger selection if it's a theme/subcode
      if (p.depth > 0) onSelect?.(p.data.id);
      
      // Update center labels for focus
      centerLabel.text(p.data.name.length > 20 ? p.data.name.substring(0,17)+'...' : p.data.name);
      centerSub.text(p.depth === 0 ? "Click to Zoom Out" : `${p.value} occurrences`);

      root.each(d => d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.y0),
        y1: Math.max(0, d.y1 - p.y0)
      });

      const t = g.transition().duration(750);

      path.transition(t)
          .tween("data", d => {
            const i = d3.interpolate(d.current || d, d.target);
            return t => d.current = i(t);
          })
          .filter(function(d) {
            return +this.getAttribute("fill-opacity") || d.target.x1 > d.target.x0;
          })
          .attr("fill-opacity", d => p === d || p.ancestors().includes(d) ? 1 : 0.5)
          .attrTween("d", d => () => arc(d.current));

      label.filter(function(d) {
          return +this.getAttribute("fill-opacity") || labelVisible(d.target);
        }).transition(t)
          .attr("fill-opacity", d => +labelVisible(d.target))
          .attrTween("transform", d => () => labelTransform(d.current));
    }
    
    function labelVisible(d) {
      return d.y1 <= radius && d.y0 >= 0 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
      const y = (d.y0 + d.y1) / 2;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }

    return () => d3.selectAll(".tooltip").remove();
  }, [masterData]);

  return <svg ref={svgRef}></svg>;
}
