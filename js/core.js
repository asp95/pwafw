var core = {
	init : function(){
		var path = window.location.pathname;
		var pathData = core.parseQueryString(window.location.search);
		core.sendRequest(path, pathData, core.rx);
		window.addEventListener("popstate", core.init);
		window.addEventListener("beforeunload", (event) => {
			console.log("unload");
			event.preventDefault();
			return false;
		});

		/*
			por config. de apache, todas las urls llaman al mismo index.php.

			cuando inicia la página, este core envía el path, la info por querystring

			core.rx es el callback, procesa los components, el diseño (donde se ubican los components), y la información devuelta para llenar los campos del component
		*/
	},
	parseQueryString : function(str){
		str = str.substring(1, str.length);
		var arrKeyValue = str.split("&");
		var arrData = {};
		for (var i = 0 ; i < arrKeyValue.length ; i++){
			var tmpKV = arrKeyValue[i].split("=");
			arrData[tmpKV[0]] = tmpKV[1];
		}
		return arrData;
	},
	sendRequest : function(path, data, cb){
		core.sendXhr(
			"/"+MAIN_DIR+"/service.php",
			{
				path : path,
				getData : JSON.stringify(data)
			},
			cb
		);
	},
	rx : function(resp){
		var arrResp = JSON.parse(resp.responseText);
		core.setComponents(arrResp.componentsHtml);
		/*
			core.setComponents(componentsArray) carga los components enviados a #components-cache
		*/
		var arrNewComponents = core.loadDesign(arrResp.design);
		/*
			core.loadDesign(designData)  limpia los divs que son marcados para limpiar mediante _clear_ y copia los components de #components-cache a la ruta marcada de cada component
		*/
		for (var i in arrResp.data){
			core.preProcess(i, arrResp.data[i]);
			if (window[i]){
				window[i].load(arrResp.data[i], arrNewComponents[i]);
			}
		}
		/*
			core.preProcess(componentName, dataModel) Realiza el reemplazo de todas las variables del component por su valor en el dataModel

			window[i].load(dataModel, currentComponent); Si en JS existe un objeto con el mismo nombre que el component, va a llamar a la función "load" de este objeto, pasándole el dataModel correspondiente al component, y el component ya cargado en la página
		*/
		core.parseHrefHandlers();

		/*
			para todos los <a>, revisa si es una url del mismo sistema, y evita que se procese como un link standar (para no recargar toda la página), y la pasa por el sistema del framework
		*/

	},
	setComponents : function(arrComponents){
		var componentsCache = document.querySelector("#components-cache");
		for(var componentName in arrComponents){
			console.log(componentName);
			if (!componentsCache.querySelector(".component."+componentName)){
				componentsCache.innerHTML += "<cmp>"+arrComponents[componentName]+"</cmp>";
				var newComponent = componentsCache.querySelector("cmp:last-child");
				newComponent.classList.add("component");
				newComponent.classList.add(componentName);
			}
		}
	},
	loadDesign : function (arrDesign){
		var arrNewComponents  = [];
		for(var componentName in arrDesign){
			if (componentName.indexOf("body ") != -1){
				continue;
			}
			if (componentName == "_clear_"){
				var arrClearComponents = document.querySelectorAll(arrDesign[componentName]+" > *");
				for(var i = 0 ; i < arrClearComponents.length ; i++){
					arrClearComponents[i].classList.add("closing");
					setTimeout((currChild => { return () => {
						currChild.parentElement.removeChild(currChild);
					}})(arrClearComponents[i]), 500);
				}
				continue;
			}

			var arrParentComponents = document.querySelectorAll(arrDesign[componentName]);
			for(var i = 0 ; i < arrParentComponents.length ; i++){
				arrParentComponents[i].appendChild(document.querySelector("#components-cache cmp.component."+componentName).cloneNode(true));
				var newComponent = arrParentComponents[i].querySelector("cmp.component."+componentName);
				newComponent.classList.add("opening");
				setTimeout((newComponent => { return () => {
					newComponent.classList.remove("opening");
				}})(newComponent), 500);
				if (!arrNewComponents[componentName]){
					arrNewComponents[componentName] = [];
				}
				arrNewComponents[componentName].push(newComponent);
			}
		}

		return arrNewComponents;
	},
	preProcess : function(componentName, data){
		var arrComponents = document.querySelectorAll("#main-content .component."+componentName);
		var dataKeys = ["data-textcontent", "data-src", "data-href"];
		for (var z = 0 ; z < dataKeys.length ; z++){
			var currKey = dataKeys[z];
			for(var i = 0 ; i < arrComponents.length ; i++){
				var currComponent = arrComponents[i];
				if (currComponent.hasAttribute(currKey)){
					fillComponent(currKey, currComponent, data);
				}
				var arrTextContentElements = currComponent.querySelectorAll("*["+currKey+"]");
				for (var x = 0 ; x < arrTextContentElements.length ; x++){
					var currInnerComponent = arrTextContentElements[x];
					if (currInnerComponent.hasAttribute(currKey)){
						fillComponent(currKey, currInnerComponent, data);
					}
				}
			}
			
		}

		function fillComponent(currKey, component, data){
			switch (currKey){
				case "data-textcontent":
					component.textContent = core.getParsedPath(data, component.getAttribute(currKey));
					break;
				case "data-src":
					component.src = core.getParsedPath(data, component.getAttribute(currKey));
					break;
				case "data-href":
					component.href = core.getParsedPath(data, component.getAttribute(currKey));
					break;	
			}
		}
	},
	getParsedPath : function(data, path){
		var arrPaths = path.split(".");
		var tmpDataPart = data;
		for (var i = 0 ; i < arrPaths.length ; i++){
			if (typeof tmpDataPart[arrPaths[i]] === "undefined"){
				return "";
			}
			tmpDataPart = tmpDataPart[arrPaths[i]];
		}
		return tmpDataPart;
	},
	parseHrefHandlers : function(){
		var arrA = document.querySelectorAll("#main-content a");
		for (var  i = 0 ; i < arrA.length ; i++){
			if (!arrA[i].hrefProcessed){
				arrA[i].addEventListener("click", ((element) => { return (event) => {
					core.link.handle(element, event);
				}})(arrA[i]));
				arrA[i].hrefProcessed = true;
			}
		}
	},
	sendXhr : function (url, data, callback, cb2) {
		function param(obj){
			var str="";
			for (var key in obj) {
				str += key + "=" + encodeURIComponent(obj[key])+"&";
			}
			return str.substring(0, str.length - 1);
		}

		var x = new XMLHttpRequest();
		x.open("POST", url, true);
		x.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		x.send(param(data));
		x.onreadystatechange = function() {
			if (x.readyState == 4 && x.status == 200) {
				callback(x);
			}
			if (cb2 && x.readyState == 4 && x.status != 200){
				cb2(x.status);
			}
		};
	},
	link : {
		handle : function(element, event){
			if (element.href.split("/")[3] == MAIN_DIR.split("/")[0] && element.href.split("/")[2] == document.location.host){
				history.pushState({}, "", element.href);
				core.init();
				event.preventDefault();
				return false;
			} 
			return true;
		}
	}
}