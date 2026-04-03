import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function KnowledgeGraph({ masterData }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!masterData || !svgRef.current) return;
    const { codebook, analyses } = masterData;

    // Build Nodes & Links
    const nodesMap = new Map();
    const linksMap = new Map();

    const addNode = (id, group, label) => {
      if (!nodesMap.has(id)) nodesMap.set(id, { id, group, label, weight: 0 });
    };

    // Initialize all themes and subcodes as nodes
    codebook.themes.forEach(t => {
      addNode(t.id, 'theme', t.label);
      (t.sub_codes || []).forEach(sc => {
        addNode(sc.id, 'subcode', sc.label);
        // Link subcode to parent theme
        const linkId = `${t.id}-${sc.id}`;
        linksMap.set(linkId, { source: sc.id, target: t.id, value: 5, type: 'hierarchy' });
      });
    });

    // Process co-occurrences in documents
    Object.values(analyses).forEach(doc => {
      if (!doc.tags) return;
      const docIds = new Set();
      doc.tags.forEach(tag => {
        if (nodesMap.has(tag.theme_id)) {
          nodesMap.get(tag.theme_id).weight++;
          docIds.add(tag.theme_id);
        }
        if (tag.sub_code_id && nodesMap.has(tag.sub_code_id)) {
          nodesMap.get(tag.sub_code_id).weight++;
          docIds.add(tag.sub_code_id);
        }
      });

      // Permutate strictly distinct pairs for co-occurrence links
      const idsArr = Array.from(docIds);
      for (let i = 0; i < idsArr.length; i++) {
        for (let j = i + 1; j < idsArr.length; j++) {
          const s = idsArr[i], t = idsArr[j];
          const sorted = [s, t].sort().join('-');
          if (!linksMap.has(sorted)) {
            linksMap.set(sorted, { source: s, target: t, value: 1, type: 'co-occur' });
          } else {
            linksMap.get(sorted).value++;
          }
        }
      }
    });

    const nodes = Array.from(nodesMap.values());
    const links = Array.from(linksMap.values()).filter(l => l.value > 1 || l.type === 'hierarchy'); // drop very weak links

    const width = 800;
    const height = 600;

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    // Graph Simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.type === 'hierarchy' ? 50 : 150))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX())
      .force("y", d3.forceY());

    // Draw Links
    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => d.type === 'hierarchy' ? "rgba(255,255,255,0.4)" : "rgba(59, 130, 246, 0.2)")
      .attr("stroke-width", d => Math.sqrt(d.value))
      .attr("stroke-dasharray", d => d.type === 'hierarchy' ? "0" : "4 4");

    const nodeGroup = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(drag(simulation));

    // Draw Nodes
    const radiusScale = d3.scaleSqrt().domain([0, d3.max(nodes, d => d.weight)||10]).range([5, 25]);
    
    nodeGroup.append("circle")
      .attr("r", d => radiusScale(d.weight))
      .attr("fill", d => d.group === 'theme' ? "var(--primary)" : "var(--accent)")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("opacity", 0.9);

    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip glass-panel")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("padding", "8px")
      .style("pointer-events", "none");

    nodeGroup.on("mouseover", function(event, d) {
      tooltip.transition().duration(200).style("opacity", .9);
      tooltip.html(`<strong>${d.label}</strong><br/>Occurrences: ${d.weight}`)
             .style("left", (event.pageX + 15) + "px")
             .style("top", (event.pageY - 28) + "px");
    }).on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });

    nodeGroup.append("text")
      .attr("x", 8)
      .attr("y", "0.31em")
      .text(d => d.label)
      .style("font-size", "10px")
      .style("fill", "var(--text-muted)")
      .style("pointer-events", "none")
      .clone(true).lower()
      .attr("fill", "none")
      .attr("stroke", "var(--bg-base)")
      .attr("stroke-width", 3);

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    return () => {
      simulation.stop();
      d3.selectAll(".tooltip").remove();
    };
  }, [masterData]);

  return <svg ref={svgRef} width="100%" height="600px"></svg>;
}
