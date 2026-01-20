/**
 * PDF Export Utility
 * Generates professional intelligence report PDF documents from analysis content
 *
 * Features:
 * - Professional intelligence report styling
 * - Classification banners and reference numbers
 * - Executive summary highlighting
 * - Source citations extraction and formatting
 * - Page numbers and print optimization
 * - A4/Letter size compatibility
 */

import { marked } from 'marked';

interface PDFExportOptions {
	title?: string;
	subtitle?: string;
	timestamp?: Date;
	includeHeader?: boolean;
	includeFooter?: boolean;
	classification?: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP SECRET';
	reportType?: string;
}

/**
 * Data sources used by the Aegis Situation Monitor
 */
const AEGIS_DATA_SOURCES = {
	news: {
		category: 'News & Intelligence Feeds',
		sources: [
			{ name: 'BBC World News', url: 'https://www.bbc.com/news/world' },
			{ name: 'NPR News', url: 'https://www.npr.org/sections/news/' },
			{ name: 'The Guardian', url: 'https://www.theguardian.com/world' },
			{ name: 'New York Times', url: 'https://www.nytimes.com/section/world' },
			{ name: 'Hacker News', url: 'https://news.ycombinator.com/' },
			{ name: 'Ars Technica', url: 'https://arstechnica.com/' },
			{ name: 'The Verge', url: 'https://www.theverge.com/' },
			{ name: 'MIT Technology Review', url: 'https://www.technologyreview.com/' }
		]
	},
	intel: {
		category: 'Intelligence & Analysis',
		sources: [
			{ name: 'CSIS', url: 'https://www.csis.org/' },
			{ name: 'Brookings Institution', url: 'https://www.brookings.edu/' },
			{ name: 'Council on Foreign Relations', url: 'https://www.cfr.org/' },
			{ name: 'Defense One', url: 'https://www.defenseone.com/' },
			{ name: 'War on the Rocks', url: 'https://warontherocks.com/' },
			{ name: 'Bellingcat', url: 'https://www.bellingcat.com/' },
			{ name: 'CISA Alerts', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories' }
		]
	},
	markets: {
		category: 'Financial Markets',
		sources: [
			{ name: 'Yahoo Finance API', url: 'https://finance.yahoo.com/' },
			{ name: 'Alpha Vantage API', url: 'https://www.alphavantage.co/' },
			{ name: 'CNBC', url: 'https://www.cnbc.com/' },
			{ name: 'MarketWatch', url: 'https://www.marketwatch.com/' }
		]
	},
	crypto: {
		category: 'Cryptocurrency',
		sources: [
			{ name: 'CoinGecko API', url: 'https://www.coingecko.com/' }
		]
	},
	government: {
		category: 'Government Sources',
		sources: [
			{ name: 'White House', url: 'https://www.whitehouse.gov/news/' },
			{ name: 'Federal Reserve', url: 'https://www.federalreserve.gov/' },
			{ name: 'SEC', url: 'https://www.sec.gov/' },
			{ name: 'Department of Defense', url: 'https://www.defense.gov/' },
			{ name: 'USASpending.gov', url: 'https://www.usaspending.gov/' }
		]
	},
	environmental: {
		category: 'Environmental Monitoring',
		sources: [
			{ name: 'USGS Earthquake API', url: 'https://earthquake.usgs.gov/' },
			{ name: 'Safecast Radiation Network', url: 'https://safecast.org/' },
			{ name: 'ProMED Disease Surveillance', url: 'https://promedmail.org/' }
		]
	},
	infrastructure: {
		category: 'Infrastructure Monitoring',
		sources: [
			{ name: 'IODA (Internet Outage Detection)', url: 'https://ioda.inetintel.cc.gatech.edu/' },
			{ name: 'OONI', url: 'https://ooni.org/' },
			{ name: 'Internet Society Pulse', url: 'https://pulse.internetsociety.org/' }
		]
	},
	alternative: {
		category: 'Alternative Data',
		sources: [
			{ name: 'Polymarket', url: 'https://polymarket.com/' },
			{ name: 'Layoffs.fyi', url: 'https://layoffs.fyi/' }
		]
	}
};

interface ExtractedLink {
	title: string;
	url: string;
}

interface ExtractedContent {
	html: string;
	sources: string[];
	articleLinks: ExtractedLink[];
	hasExecutiveSummary: boolean;
}

/**
 * Generate a unique report reference number
 */
function generateReportReference(timestamp: Date): string {
	const year = timestamp.getFullYear();
	const month = String(timestamp.getMonth() + 1).padStart(2, '0');
	const day = String(timestamp.getDate()).padStart(2, '0');
	const sequence = Math.random().toString(36).substring(2, 6).toUpperCase();
	return `ART-${year}${month}${day}-${sequence}`;
}

/**
 * Extract source citations from content
 * Looks for patterns like [Source: ...], (Source: ...), [Ref: ...], etc.
 */
function extractSources(content: string): string[] {
	const sources: string[] = [];
	const patterns = [
		/\[Source:\s*([^\]]+)\]/gi,
		/\(Source:\s*([^)]+)\)/gi,
		/\[Ref:\s*([^\]]+)\]/gi,
		/\[Reference:\s*([^\]]+)\]/gi,
		/Source:\s*([^\n.]+)/gi,
		/\[(\d+)\]\s*([^\n]+)/g // Numbered references like [1] Some source
	];

	patterns.forEach((pattern) => {
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const source = match[1]?.trim() || match[2]?.trim();
			if (source && !sources.includes(source) && source.length > 3) {
				sources.push(source);
			}
		}
	});

	return sources;
}

/**
 * Extract markdown links from content
 * Looks for patterns like [Title](url)
 */
function extractArticleLinks(content: string): ExtractedLink[] {
	const links: ExtractedLink[] = [];
	const seenUrls = new Set<string>();

	// Match markdown links: [text](url)
	const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi;

	let match;
	while ((match = linkPattern.exec(content)) !== null) {
		const title = match[1]?.trim();
		const url = match[2]?.trim();

		// Skip if already seen or if it's a generic "Link" text
		if (title && url && !seenUrls.has(url) && title.toLowerCase() !== 'link') {
			seenUrls.add(url);
			links.push({ title, url });
		}
	}

	return links;
}

/**
 * Check if content starts with an executive summary section
 */
function hasExecutiveSummary(content: string): boolean {
	const summaryPatterns = [
		/^#*\s*(executive\s+summary|summary|overview|key\s+findings|tldr|tl;dr)/im,
		/^>\s*(executive\s+summary|summary|key\s+takeaway)/im
	];

	return summaryPatterns.some((pattern) => pattern.test(content.substring(0, 500)));
}

/**
 * Process content: extract sources, detect summary, convert to HTML
 */
function processContent(content: string): ExtractedContent {
	const sources = extractSources(content);
	const articleLinks = extractArticleLinks(content);
	const hasSummary = hasExecutiveSummary(content);

	// Remove source citations from main content (they'll be in references)
	let cleanedContent = content
		.replace(/\[Source:\s*[^\]]+\]/gi, '')
		.replace(/\(Source:\s*[^)]+\)/gi, '')
		.replace(/\[Ref:\s*[^\]]+\]/gi, '');

	// Convert markdown to HTML
	let html = marked.parse(cleanedContent) as string;

	// Wrap executive summary section in special styling
	if (hasSummary) {
		html = html.replace(
			/<h([1-3])>(Executive\s+Summary|Summary|Overview|Key\s+Findings|TLDR|TL;DR)<\/h\1>/gi,
			'<div class="executive-summary-wrapper"><h$1 class="executive-summary-title">$2</h$1>'
		);

		// Find the next heading and close the wrapper before it
		html = html.replace(
			/(<div class="executive-summary-wrapper">.*?)(<h[1-4]>(?!Executive|Summary|Overview|Key))/is,
			'$1</div>$2'
		);

		// If no closing heading found, close at end of first few paragraphs
		if (html.includes('executive-summary-wrapper') && !html.includes('</div><h')) {
			const wrapperStart = html.indexOf('<div class="executive-summary-wrapper">');
			const contentAfterWrapper = html.substring(wrapperStart);
			const paragraphs = contentAfterWrapper.split('</p>');
			if (paragraphs.length > 3) {
				const closingPoint = html.indexOf('</p>', html.indexOf('</p>', wrapperStart) + 4);
				if (closingPoint > 0) {
					html =
						html.substring(0, closingPoint + 4) +
						'</div>' +
						html.substring(closingPoint + 4);
				}
			}
		}
	}

	// Style blockquotes as intelligence callouts
	html = html.replace(
		/<blockquote>/g,
		'<blockquote class="intel-callout"><span class="callout-label">KEY INTELLIGENCE</span>'
	);

	// Add alternating row colors to tables
	html = html.replace(/<tbody>/g, '<tbody class="alternating-rows">');

	return { html, sources, articleLinks, hasExecutiveSummary: hasSummary };
}

/**
 * Generate PDF-ready HTML document with professional styling
 */
function generatePDFHTML(content: string, options: PDFExportOptions = {}): string {
	const {
		title = 'PROJECT ARTEMIS - Intelligence Analysis',
		subtitle = 'Situation Monitor Report',
		timestamp = new Date(),
		includeHeader = true,
		includeFooter = true,
		classification = 'CONFIDENTIAL',
		reportType = 'INTELLIGENCE ANALYSIS'
	} = options;

	const reportRef = generateReportReference(timestamp);

	const formattedDate = timestamp.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	const formattedTime = timestamp.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: true
	});
	const shortDate = timestamp.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});

	const { html: htmlContent, sources, articleLinks } = processContent(content);

	// Generate comprehensive sources section
	let sourcesSection = `
		<section class="sources-section">
			<h2 class="sources-title">Sources & References</h2>
	`;

	// Add article links if any were extracted from content
	if (articleLinks.length > 0) {
		sourcesSection += `
			<div class="sources-subsection">
				<h3 class="sources-subtitle">Referenced Articles</h3>
				<ol class="sources-list article-links">
					${articleLinks.slice(0, 20).map((link, i) => `<li><span class="source-number">[${i + 1}]</span> <a href="${link.url}" target="_blank">${link.title}</a></li>`).join('\n')}
				</ol>
			</div>
		`;
	}

	// Add extracted inline sources if any
	if (sources.length > 0) {
		sourcesSection += `
			<div class="sources-subsection">
				<h3 class="sources-subtitle">Cited Sources</h3>
				<ol class="sources-list">
					${sources.map((source, i) => `<li><span class="source-number">[${articleLinks.length + i + 1}]</span> ${source}</li>`).join('\n')}
				</ol>
			</div>
		`;
	}

	// Always add the data sources/APIs section
	sourcesSection += `
			<div class="sources-subsection data-sources">
				<h3 class="sources-subtitle">Data Sources & APIs</h3>
				<div class="data-sources-grid">
					${Object.entries(AEGIS_DATA_SOURCES).map(([, category]) => `
						<div class="data-source-category">
							<h4 class="category-name">${category.category}</h4>
							<ul class="category-sources">
								${category.sources.map(s => `<li><a href="${s.url}" target="_blank">${s.name}</a></li>`).join('\n')}
							</ul>
						</div>
					`).join('\n')}
				</div>
			</div>
		</section>
	`;

	// Classification color mapping
	const classificationColors: Record<string, { bg: string; text: string; border: string }> = {
		UNCLASSIFIED: { bg: '#22c55e', text: '#ffffff', border: '#16a34a' },
		CONFIDENTIAL: { bg: '#06b6d4', text: '#ffffff', border: '#0891b2' },
		SECRET: { bg: '#f59e0b', text: '#000000', border: '#d97706' },
		'TOP SECRET': { bg: '#ef4444', text: '#ffffff', border: '#dc2626' }
	};

	const classColors = classificationColors[classification] || classificationColors['CONFIDENTIAL'];

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title} - ${reportRef}</title>
	<style>
		@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@600;700&display=swap');

		:root {
			--color-primary: #06b6d4;
			--color-primary-dark: #0891b2;
			--color-accent: #0ea5e9;
			--color-dark: #0f172a;
			--color-text: #1e293b;
			--color-text-light: #64748b;
			--color-text-muted: #94a3b8;
			--color-border: #e2e8f0;
			--color-bg-light: #f8fafc;
			--color-bg-subtle: #f1f5f9;
			--color-classification-bg: ${classColors.bg};
			--color-classification-text: ${classColors.text};
			--color-classification-border: ${classColors.border};
		}

		@page {
			size: A4;
			margin: 20mm 15mm 25mm 15mm;

			@top-center {
				content: "${classification}";
				font-family: 'Inter', sans-serif;
				font-size: 8pt;
				font-weight: 700;
				letter-spacing: 0.15em;
				color: var(--color-classification-bg);
			}

			@bottom-left {
				content: "PROJECT ARTEMIS - ${reportRef}";
				font-family: 'Inter', sans-serif;
				font-size: 7pt;
				color: #64748b;
			}

			@bottom-right {
				content: "Page " counter(page) " of " counter(pages);
				font-family: 'Inter', sans-serif;
				font-size: 7pt;
				color: #64748b;
			}
		}

		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 10.5pt;
			line-height: 1.7;
			color: var(--color-text);
			background: #ffffff;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.document {
			max-width: 210mm;
			margin: 0 auto;
			padding: 0;
		}

		/* Classification Banner */
		.classification-banner {
			background: var(--color-classification-bg);
			color: var(--color-classification-text);
			text-align: center;
			padding: 6px 0;
			font-size: 9pt;
			font-weight: 700;
			letter-spacing: 0.2em;
			border-bottom: 2px solid var(--color-classification-border);
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			z-index: 1000;
		}

		.classification-banner-bottom {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			background: var(--color-classification-bg);
			color: var(--color-classification-text);
			text-align: center;
			padding: 4px 0;
			font-size: 8pt;
			font-weight: 700;
			letter-spacing: 0.2em;
			border-top: 2px solid var(--color-classification-border);
		}

		/* Header */
		.header {
			padding: 30px 40px 25px;
			border-bottom: 3px solid var(--color-primary);
			background: linear-gradient(180deg, var(--color-bg-light) 0%, #ffffff 100%);
			margin-top: 30px;
		}

		.header-top {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			margin-bottom: 20px;
		}

		.logo {
			display: flex;
			align-items: center;
			gap: 14px;
		}

		.logo-icon {
			width: 48px;
			height: 48px;
			background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
			border-radius: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
		}

		.logo-icon svg {
			width: 28px;
			height: 28px;
			fill: white;
		}

		.logo-icon::after {
			content: "\\25C7";
			font-size: 24px;
			color: white;
			font-weight: bold;
		}

		.logo-text-group {
			display: flex;
			flex-direction: column;
		}

		.logo-text {
			font-family: 'Playfair Display', serif;
			font-size: 18pt;
			font-weight: 700;
			letter-spacing: 0.08em;
			color: var(--color-dark);
			line-height: 1.1;
		}

		.logo-subtitle {
			font-size: 8pt;
			font-weight: 600;
			letter-spacing: 0.15em;
			color: var(--color-text-light);
			text-transform: uppercase;
			margin-top: 3px;
		}

		.header-right {
			text-align: right;
		}

		.report-type {
			background: var(--color-primary);
			color: white;
			padding: 6px 16px;
			font-size: 8pt;
			font-weight: 700;
			letter-spacing: 0.12em;
			border-radius: 3px;
			display: inline-block;
			margin-bottom: 8px;
			box-shadow: 0 2px 8px rgba(6, 182, 212, 0.25);
		}

		.report-ref {
			font-family: 'JetBrains Mono', monospace;
			font-size: 9pt;
			font-weight: 500;
			color: var(--color-text-light);
			letter-spacing: 0.05em;
		}

		.header-meta {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 20px;
			padding-top: 15px;
			border-top: 1px solid var(--color-border);
		}

		.meta-item {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		.meta-label {
			font-size: 7pt;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--color-text-muted);
		}

		.meta-value {
			font-size: 9pt;
			font-weight: 500;
			color: var(--color-text);
		}

		.meta-value.mono {
			font-family: 'JetBrains Mono', monospace;
		}

		/* Main Content */
		.content {
			padding: 35px 45px 50px;
			min-height: 500px;
		}

		/* Executive Summary Box */
		.executive-summary-wrapper {
			background: linear-gradient(135deg, #ecfeff 0%, #f0f9ff 50%, #f8fafc 100%);
			border: 2px solid var(--color-primary);
			border-radius: 8px;
			padding: 20px 25px;
			margin-bottom: 30px;
			position: relative;
			box-shadow: 0 4px 16px rgba(6, 182, 212, 0.1);
		}

		.executive-summary-wrapper::before {
			content: "EXECUTIVE BRIEFING";
			position: absolute;
			top: -10px;
			left: 20px;
			background: var(--color-primary);
			color: white;
			font-size: 7pt;
			font-weight: 700;
			letter-spacing: 0.15em;
			padding: 3px 10px;
			border-radius: 2px;
		}

		.executive-summary-title {
			color: var(--color-primary-dark) !important;
			margin-top: 5px !important;
		}

		/* Typography - Enhanced for readability */
		.content h1 {
			font-family: 'Playfair Display', serif;
			font-size: 20pt;
			font-weight: 700;
			color: var(--color-dark);
			margin: 0 0 24px;
			padding-bottom: 14px;
			border-bottom: 2px solid var(--color-primary);
			letter-spacing: 0.02em;
		}

		.content h2 {
			font-size: 14pt;
			font-weight: 700;
			color: var(--color-dark);
			margin: 36px 0 18px;
			padding-bottom: 10px;
			border-bottom: 1px solid var(--color-border);
			letter-spacing: 0.01em;
		}

		.content h2:first-child {
			margin-top: 0;
		}

		.content h3 {
			font-size: 12pt;
			font-weight: 600;
			color: var(--color-text);
			margin: 28px 0 14px;
			padding-left: 12px;
			border-left: 4px solid var(--color-primary);
		}

		.content h4 {
			font-size: 10.5pt;
			font-weight: 700;
			color: var(--color-text-light);
			margin: 22px 0 12px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}

		.content h5 {
			font-size: 10pt;
			font-weight: 600;
			color: var(--color-text);
			margin: 18px 0 10px;
		}

		/* Paragraphs with better spacing */
		.content p {
			margin: 0 0 16px;
			text-align: justify;
			hyphens: auto;
			line-height: 1.75;
		}

		/* Reduce top margin when paragraph follows header */
		.content h2 + p,
		.content h3 + p,
		.content h4 + p {
			margin-top: 0;
		}

		/* Lists with improved spacing */
		.content ul, .content ol {
			margin: 18px 0 22px;
			padding-left: 28px;
		}

		.content ul {
			list-style: none;
		}

		.content ul li {
			position: relative;
			margin: 10px 0;
			padding-left: 10px;
			line-height: 1.65;
		}

		.content ul li::before {
			content: "";
			position: absolute;
			left: -18px;
			top: 9px;
			width: 7px;
			height: 7px;
			background: var(--color-primary);
			border-radius: 50%;
		}

		.content ol li {
			margin: 10px 0;
			padding-left: 6px;
			line-height: 1.65;
		}

		.content ol li::marker {
			color: var(--color-primary);
			font-weight: 700;
		}

		/* Nested lists */
		.content li > ul,
		.content li > ol {
			margin: 8px 0 8px 0;
		}

		/* Bold text - Enhanced for emphasis */
		.content strong {
			color: var(--color-dark);
			font-weight: 700;
		}

		/* Special styling for threat levels and key indicators */
		.content p strong,
		.content li strong {
			background: linear-gradient(180deg, transparent 60%, rgba(6, 182, 212, 0.15) 60%);
			padding: 0 2px;
		}

		/* Bold in headers shouldn't have the underline effect */
		.content h1 strong,
		.content h2 strong,
		.content h3 strong,
		.content h4 strong {
			background: none;
			padding: 0;
		}

		.content em {
			color: var(--color-text);
			font-style: italic;
		}

		/* Code Blocks */
		.content code {
			background: var(--color-bg-subtle);
			padding: 2px 8px;
			border-radius: 4px;
			font-family: 'JetBrains Mono', monospace;
			font-size: 9pt;
			color: var(--color-primary-dark);
			border: 1px solid var(--color-border);
		}

		.content pre {
			background: var(--color-dark);
			color: #e2e8f0;
			padding: 18px 22px;
			border-radius: 6px;
			overflow-x: auto;
			margin: 20px 0;
			font-family: 'JetBrains Mono', monospace;
			font-size: 9pt;
			line-height: 1.6;
			border-left: 4px solid var(--color-primary);
			box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
		}

		.content pre code {
			background: none;
			color: inherit;
			padding: 0;
			border: none;
			font-size: inherit;
		}

		/* Intelligence Callout (Blockquotes) */
		.intel-callout {
			border: none;
			border-left: 4px solid var(--color-primary);
			margin: 22px 0;
			padding: 18px 22px 18px 22px;
			background: linear-gradient(90deg, #ecfeff 0%, var(--color-bg-light) 100%);
			border-radius: 0 6px 6px 0;
			position: relative;
			font-style: normal;
			box-shadow: 0 2px 8px rgba(6, 182, 212, 0.08);
		}

		.callout-label {
			display: block;
			font-size: 7pt;
			font-weight: 700;
			letter-spacing: 0.15em;
			color: var(--color-primary-dark);
			margin-bottom: 10px;
			padding-bottom: 8px;
			border-bottom: 1px dashed var(--color-border);
		}

		.intel-callout p {
			margin-bottom: 0;
			color: var(--color-text);
			font-weight: 500;
		}

		/* Horizontal Rule - Visual section separator */
		.content hr {
			border: none;
			height: 2px;
			background: linear-gradient(to right, transparent 0%, var(--color-primary) 20%, var(--color-primary) 80%, transparent 100%);
			margin: 40px 0;
			opacity: 0.6;
		}

		/* Tables - Enhanced with better spacing */
		.content table {
			width: 100%;
			border-collapse: collapse;
			margin: 26px 0;
			font-size: 9.5pt;
			border-radius: 6px;
			overflow: hidden;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
			border: 1px solid var(--color-border);
		}

		.content th {
			background: linear-gradient(180deg, var(--color-dark) 0%, #1e293b 100%);
			color: white;
			padding: 14px 18px;
			text-align: left;
			font-weight: 700;
			font-size: 8.5pt;
			text-transform: uppercase;
			letter-spacing: 0.06em;
		}

		.content td {
			padding: 13px 18px;
			border-bottom: 1px solid var(--color-border);
			vertical-align: top;
			line-height: 1.55;
		}

		/* Bold text in table cells */
		.content td strong {
			color: var(--color-primary-dark);
			background: none;
		}

		.alternating-rows tr:nth-child(odd) {
			background: var(--color-bg-light);
		}

		.alternating-rows tr:nth-child(even) {
			background: white;
		}

		.alternating-rows tr:hover {
			background: #ecfeff;
		}

		/* Sources Section */
		.sources-section {
			margin-top: 50px;
			padding-top: 25px;
			border-top: 2px solid var(--color-border);
		}

		.sources-title {
			font-size: 12pt;
			font-weight: 700;
			color: var(--color-dark);
			margin-bottom: 18px;
			display: flex;
			align-items: center;
			gap: 10px;
		}

		.sources-title::before {
			content: "";
			width: 24px;
			height: 2px;
			background: var(--color-primary);
		}

		.sources-list {
			list-style: none;
			padding: 0;
			margin: 0;
			counter-reset: source-counter;
		}

		.sources-list li {
			padding: 10px 15px;
			margin: 6px 0;
			background: var(--color-bg-light);
			border-radius: 4px;
			font-size: 9pt;
			color: var(--color-text-light);
			border-left: 3px solid var(--color-border);
			display: flex;
			gap: 10px;
		}

		.source-number {
			font-family: 'JetBrains Mono', monospace;
			font-weight: 600;
			color: var(--color-primary);
			min-width: 28px;
		}

		.sources-subsection {
			margin-bottom: 25px;
		}

		.sources-subtitle {
			font-size: 10pt;
			font-weight: 600;
			color: var(--color-text);
			margin-bottom: 12px;
			padding-bottom: 6px;
			border-bottom: 1px dashed var(--color-border);
		}

		.sources-list a {
			color: var(--color-primary-dark);
			text-decoration: none;
		}

		.sources-list a:hover {
			text-decoration: underline;
		}

		.article-links li {
			border-left-color: var(--color-primary);
		}

		.data-sources-grid {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 20px;
		}

		.data-source-category {
			background: var(--color-bg-light);
			border-radius: 6px;
			padding: 15px;
			border: 1px solid var(--color-border);
		}

		.category-name {
			font-size: 9pt;
			font-weight: 700;
			color: var(--color-primary-dark);
			margin: 0 0 10px 0;
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}

		.category-sources {
			list-style: none;
			padding: 0;
			margin: 0;
		}

		.category-sources li {
			font-size: 8.5pt;
			padding: 4px 0;
			color: var(--color-text-light);
		}

		.category-sources a {
			color: var(--color-text);
			text-decoration: none;
		}

		.category-sources a:hover {
			color: var(--color-primary);
			text-decoration: underline;
		}

		/* Footer */
		.footer {
			border-top: 2px solid var(--color-primary);
			padding: 20px 40px;
			margin-top: 40px;
			background: var(--color-bg-light);
		}

		.footer-content {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
		}

		.footer-left {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		.footer-logo {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 9pt;
			font-weight: 700;
			color: var(--color-dark);
		}

		.footer-logo-icon {
			color: var(--color-primary);
			font-size: 12pt;
		}

		.footer-tagline {
			font-size: 7.5pt;
			color: var(--color-text-muted);
			letter-spacing: 0.05em;
		}

		.footer-right {
			text-align: right;
		}

		.footer-meta {
			font-size: 8pt;
			color: var(--color-text-light);
			margin-bottom: 8px;
		}

		.footer-meta strong {
			color: var(--color-text);
		}

		.footer-confidential {
			font-size: 7pt;
			font-weight: 600;
			letter-spacing: 0.1em;
			color: var(--color-text-muted);
			padding: 4px 10px;
			background: var(--color-bg-subtle);
			border-radius: 3px;
			border: 1px solid var(--color-border);
		}

		.footer-disclaimer {
			margin-top: 15px;
			padding-top: 12px;
			border-top: 1px solid var(--color-border);
			font-size: 7pt;
			color: var(--color-text-muted);
			text-align: center;
			line-height: 1.5;
		}

		/* Print Optimizations */
		@media print {
			body {
				-webkit-print-color-adjust: exact !important;
				print-color-adjust: exact !important;
			}

			.document {
				max-width: none;
			}

			.classification-banner,
			.classification-banner-bottom {
				display: none; /* Handled by @page rules in print */
			}

			.header {
				margin-top: 0;
				break-after: avoid;
			}

			.content {
				padding: 25px 0;
			}

			.footer {
				padding: 15px 0;
			}

			/* Prevent breaks */
			h1, h2, h3, h4, h5, h6 {
				break-after: avoid;
				page-break-after: avoid;
			}

			p {
				orphans: 3;
				widows: 3;
			}

			pre, blockquote, .intel-callout {
				break-inside: avoid;
				page-break-inside: avoid;
			}

			table {
				break-inside: avoid;
				page-break-inside: avoid;
			}

			tr {
				break-inside: avoid;
				page-break-inside: avoid;
			}

			.executive-summary-wrapper {
				break-inside: avoid;
				page-break-inside: avoid;
			}

			.sources-section {
				break-before: avoid;
			}

			.sources-list li {
				break-inside: avoid;
				page-break-inside: avoid;
			}

			/* Ensure images don't break */
			img {
				break-inside: avoid;
				page-break-inside: avoid;
				max-width: 100%;
			}
		}

		/* Screen preview styles */
		@media screen {
			body {
				background: #e2e8f0;
				padding: 30px;
			}

			.document {
				background: white;
				box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
				border-radius: 4px;
				margin-bottom: 30px;
			}

			.classification-banner,
			.classification-banner-bottom {
				position: sticky;
				margin: 0 -30px;
				width: calc(100% + 60px);
			}

			.classification-banner {
				margin-top: -30px;
				margin-bottom: 0;
				border-radius: 4px 4px 0 0;
			}
		}

		/* A4 & Letter Size Compatibility */
		@media print and (min-width: 8in) {
			/* Letter size adjustments */
			.content {
				padding: 25px 35px 35px;
			}
		}
	</style>
</head>
<body>
	<div class="classification-banner">${classification}</div>

	<div class="document">
		${
			includeHeader
				? `
		<header class="header">
			<div class="header-top">
				<div class="logo">
					<div class="logo-icon"></div>
					<div class="logo-text-group">
						<div class="logo-text">PROJECT ARTEMIS</div>
						<div class="logo-subtitle">${subtitle}</div>
					</div>
				</div>
				<div class="header-right">
					<div class="report-type">${reportType}</div>
					<div class="report-ref">${reportRef}</div>
				</div>
			</div>
			<div class="header-meta">
				<div class="meta-item">
					<span class="meta-label">Report Date</span>
					<span class="meta-value">${formattedDate}</span>
				</div>
				<div class="meta-item">
					<span class="meta-label">Generated</span>
					<span class="meta-value mono">${formattedTime}</span>
				</div>
				<div class="meta-item">
					<span class="meta-label">Reference</span>
					<span class="meta-value mono">${reportRef}</span>
				</div>
			</div>
		</header>
		`
				: ''
		}

		<main class="content">
			${htmlContent}
		</main>

		${sourcesSection}

		${
			includeFooter
				? `
		<footer class="footer">
			<div class="footer-content">
				<div class="footer-left">
					<div class="footer-logo">
						<span class="footer-logo-icon">&#9671;</span>
						<span>PROJECT ARTEMIS</span>
					</div>
					<div class="footer-tagline">Intelligence Analysis System</div>
				</div>
				<div class="footer-right">
					<div class="footer-meta">
						<strong>Generated:</strong> ${shortDate} at ${formattedTime}
					</div>
					<div class="footer-confidential">FOR AUTHORIZED USE ONLY</div>
				</div>
			</div>
			<div class="footer-disclaimer">
				This document contains intelligence analysis generated by PROJECT ARTEMIS.
				Distribution is limited to authorized personnel only.
				Unauthorized disclosure may be subject to applicable laws and regulations.
			</div>
		</footer>
		`
				: ''
		}
	</div>

	<div class="classification-banner-bottom">${classification}</div>
</body>
</html>`;
}

/**
 * Export analysis content to PDF via print dialog
 */
export function exportToPDF(content: string, options: PDFExportOptions = {}): void {
	const html = generatePDFHTML(content, options);

	// Create a new window for printing
	const printWindow = window.open('', '_blank', 'width=900,height=700');
	if (!printWindow) {
		alert('Please allow popups to export PDF');
		return;
	}

	printWindow.document.write(html);
	printWindow.document.close();

	// Wait for fonts and content to load, then trigger print
	printWindow.onload = () => {
		// Allow time for fonts to load
		setTimeout(() => {
			printWindow.print();
		}, 500);
	};
}

/**
 * Download HTML as file (alternative to PDF)
 */
export function downloadAsHTML(
	content: string,
	filename: string,
	options: PDFExportOptions = {}
): void {
	const html = generatePDFHTML(content, options);
	const blob = new Blob([html], { type: 'text/html' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Preview PDF in new window without immediately printing
 */
export function previewPDF(content: string, options: PDFExportOptions = {}): Window | null {
	const html = generatePDFHTML(content, options);

	const previewWindow = window.open('', '_blank', 'width=900,height=700');
	if (!previewWindow) {
		alert('Please allow popups to preview the document');
		return null;
	}

	previewWindow.document.write(html);
	previewWindow.document.close();

	return previewWindow;
}

/**
 * Copy content as formatted text
 */
export function copyToClipboard(content: string): Promise<void> {
	return navigator.clipboard.writeText(content);
}

/**
 * Get available classification levels
 */
export function getClassificationLevels(): string[] {
	return ['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP SECRET'];
}
