import htmlTemplate from "./theme-settings.html";
import stylesheet from "!!css-loader!./theme-settings.css";

export class ThemeSettingsComponent extends HTMLElement
{
	constructor()
	{
		super();
		this.attachShadow({mode: "open"});

		const element = document.createElement("template");
		element.innerHTML = htmlTemplate;

		const styleElement = document.createElement("style");
		styleElement.innerHTML = stylesheet.toString();

		this.shadowRoot.append(styleElement);
		this.shadowRoot.append(element.content.cloneNode(true));

		this.toggleElement = this.shadowRoot.querySelector("#theme-toggle");
	}
}